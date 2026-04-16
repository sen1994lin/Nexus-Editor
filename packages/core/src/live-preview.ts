import { StateField, type Extension, type Range, type SelectionRange, type Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import type { Heading, Root } from "mdast";

import { collectLivePreviewRanges, selectionIntersects } from "./live-preview-ranges";
import { renderLivePreviewNode } from "./live-preview-renderers";
import type {
  LivePreviewConfig,
  LivePreviewNodeType,
  LivePreviewRenderer,
  ParserLike
} from "./types";

interface NormalizedLivePreviewConfig {
  enabled: boolean;
  renderers: Partial<Record<LivePreviewNodeType, LivePreviewRenderer>>;
}

function createEmptyAst(): Root {
  return {
    type: "root",
    children: []
  };
}

function parseDocument(parser: ParserLike, markdown: string): Root {
  try {
    return parser.parse(markdown);
  } catch {
    return createEmptyAst();
  }
}

function normalizeConfig(
  config: boolean | LivePreviewConfig | undefined
): NormalizedLivePreviewConfig {
  if (!config) {
    return {
      enabled: false,
      renderers: {}
    };
  }

  if (config === true) {
    return {
      enabled: true,
      renderers: {}
    };
  }

  return {
    enabled: config.enabled ?? true,
    renderers: config.renderers ?? {}
  };
}

function createWidget(element: HTMLElement): WidgetType {
  return new (class extends WidgetType {
    toDOM() {
      return element;
    }

    ignoreEvent() {
      return false;
    }
  })();
}

const BLOCK_NODE_TYPES = new Set(["blockquote", "code", "thematicBreak"]);

const HEADING_FONT_SIZE: Record<number, string> = {
  1: "1.6em",
  2: "1.4em",
  3: "1.2em",
  4: "1.1em",
  5: "1.05em",
  6: "1em"
};

function buildHeadingDecorations(
  range: { from: number; to: number; node: Heading },
  selection: readonly SelectionRange[],
  decos: Range<Decoration>[]
): void {
  const firstChild = range.node.children[0];
  const textStart = firstChild?.position?.start?.offset;

  if (typeof textStart === "number" && textStart > range.from && textStart <= range.to) {
    const fontSize = HEADING_FONT_SIZE[range.node.depth] ?? "1em";
    const cursorOnHeading = selectionIntersects(range.from, range.to, selection);

    if (cursorOnHeading) {
      decos.push(
        Decoration.mark({
          attributes: { style: `font-weight: bold; font-size: ${fontSize}; color: #aaa` }
        }).range(range.from, textStart)
      );
    } else {
      decos.push(Decoration.replace({}).range(range.from, textStart));
    }

    decos.push(
      Decoration.mark({
        attributes: {
          style: `font-weight: bold; font-size: ${fontSize}`,
          "data-heading-level": String(range.node.depth)
        }
      }).range(textStart, range.to)
    );
  }
}

const SEPARATOR_RE = /^\|?\s*[-:]+\s*(\|\s*[-:]+\s*)*\|?\s*$/;

function buildTableDecorations(
  range: { from: number; to: number },
  doc: string,
  decos: Range<Decoration>[]
): void {
  const source = doc.slice(range.from, range.to);
  const lines = source.split("\n");
  let offset = range.from;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineEnd = offset + line.length;

    if (SEPARATOR_RE.test(line)) {
      // Hide separator line entirely (collapse the preceding newline too)
      const hideFrom = offset > range.from ? offset - 1 : offset;
      decos.push(Decoration.replace({}).range(hideFrom, lineEnd));
      offset = lineEnd + 1;
      continue;
    }

    // Find pipe positions on this line
    const pipes: number[] = [];
    for (let j = 0; j < line.length; j++) {
      if (line[j] === "|") pipes.push(offset + j);
    }

    if (pipes.length >= 2) {
      // Hide leading pipe + space after it
      const firstPipe = pipes[0];
      const afterFirst = firstPipe + 1;
      if (line.trimStart().startsWith("|")) {
        decos.push(Decoration.replace({}).range(firstPipe, afterFirst));
      }

      // Hide trailing pipe + space before it
      const lastPipe = pipes[pipes.length - 1];
      if (line.trimEnd().endsWith("|")) {
        decos.push(Decoration.replace({}).range(lastPipe, lastPipe + 1));
      }

      // Dim middle pipes
      for (let j = 1; j < pipes.length - 1; j++) {
        decos.push(
          Decoration.mark({
            attributes: { style: "color: #ccc" }
          }).range(pipes[j], pipes[j] + 1)
        );
      }
    }

    // Bold header row (first non-separator line)
    if (i === 0) {
      decos.push(
        Decoration.mark({
          attributes: { style: "font-weight: bold" }
        }).range(offset, lineEnd)
      );
    }

    offset = lineEnd + 1;
  }
}

function buildDecorations(
  doc: string,
  selection: readonly SelectionRange[],
  parser: ParserLike,
  config: NormalizedLivePreviewConfig
): DecorationSet {
  if (!config.enabled) {
    return Decoration.none;
  }

  const ast = parseDocument(parser, doc);
  const ranges = collectLivePreviewRanges(ast, doc, selection);
  const decos: Range<Decoration>[] = [];

  const parentSpans: [number, number][] = [];

  for (const range of ranges) {
    if (parentSpans.some(([from, to]) => range.from >= from && range.to <= to)) {
      continue;
    }

    if (range.node.type === "heading" && !config.renderers.heading) {
      buildHeadingDecorations(
        range as { from: number; to: number; node: Heading },
        selection,
        decos
      );
    } else if (range.node.type === "table" && !config.renderers.table) {
      const cursorOnTable = selectionIntersects(range.from, range.to, selection);
      if (cursorOnTable) {
        buildTableDecorations(range, doc, decos);
      } else {
        decos.push(
          Decoration.replace({
            widget: createWidget(renderLivePreviewNode(range.node, range.source, config.renderers)),
            block: true
          }).range(range.from, range.to)
        );
      }
    } else if (range.node.type === "image") {
      const cursorOnImage = selectionIntersects(range.from, range.to, selection);

      if (cursorOnImage) {
        // Cursor on image: dim the ![alt](url) syntax, show image preview below
        decos.push(
          Decoration.mark({
            attributes: { style: "color: #aaa" }
          }).range(range.from, range.to)
        );
        const preview = document.createElement("span");
        const img = document.createElement("img");
        img.src = range.node.url;
        img.alt = range.node.alt ?? "";
        img.referrerPolicy = "no-referrer";
        img.style.display = "block";
        img.style.maxWidth = "100%";
        preview.appendChild(img);
        decos.push(
          Decoration.widget({
            widget: createWidget(preview),
            side: 1
          }).range(range.to)
        );
      } else {
        // Cursor away: use standard widget replacement
        decos.push(
          Decoration.replace({
            widget: createWidget(renderLivePreviewNode(range.node, range.source, config.renderers))
          }).range(range.from, range.to)
        );
      }
    } else {
      if (range.node.type === "heading" || range.node.type === "table") {
        parentSpans.push([range.from, range.to]);
      }

      const isBlock = BLOCK_NODE_TYPES.has(range.node.type);
      decos.push(
        Decoration.replace({
          widget: createWidget(renderLivePreviewNode(range.node, range.source, config.renderers)),
          block: isBlock
        }).range(range.from, range.to)
      );
    }
  }

  return Decoration.set(decos, true);
}

export function createLivePreviewExtension(
  parser: ParserLike,
  config: boolean | LivePreviewConfig | undefined
): Extension[] {
  const normalized = normalizeConfig(config);

  if (!normalized.enabled) {
    return [];
  }

  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(
        state.doc.toString(),
        state.selection.ranges,
        parser,
        normalized
      );
    },
    update(decos: DecorationSet, tr: Transaction) {
      if (tr.docChanged || tr.selection) {
        return buildDecorations(
          tr.state.doc.toString(),
          tr.state.selection.ranges,
          parser,
          normalized
        );
      }
      return decos;
    },
    provide(field) {
      return EditorView.decorations.from(field);
    }
  });

  return [field];
}
