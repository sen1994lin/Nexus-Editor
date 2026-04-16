import { StateField, type Extension, type Range, type SelectionRange, type Transaction } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import type { Heading, List, Root, Table } from "mdast";

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

function createWidget(element: HTMLElement, swallowEvents = false): WidgetType {
  return new (class extends WidgetType {
    toDOM() {
      return element;
    }

    ignoreEvent() {
      return swallowEvents;
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

function extractCellText(cell: any): string {
  if (!cell || !("children" in cell) || !Array.isArray(cell.children)) return "";
  return cell.children
    .map((c: any) => {
      if ("value" in c && typeof c.value === "string") return c.value;
      if ("children" in c && Array.isArray(c.children)) {
        return c.children.map((n: any) => ("value" in n ? n.value : "")).join("");
      }
      return "";
    })
    .join("");
}

function renderTableWidget(node: Table): HTMLElement {
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.style.display = "table";

  const rows = node.children ?? [];
  if (rows.length === 0) return table;

  // Header
  const thead = document.createElement("thead");
  const headerRow = rows[0];
  const headerTr = document.createElement("tr");
  const cells = "children" in headerRow && Array.isArray(headerRow.children) ? headerRow.children : [];
  for (const cell of cells) {
    const th = document.createElement("th");
    th.textContent = extractCellText(cell);
    th.style.border = "1px solid #ddd";
    th.style.padding = "8px 12px";
    th.style.textAlign = "left";
    th.style.fontWeight = "bold";
    th.style.background = "#f6f8fa";
    headerTr.appendChild(th);
  }
  thead.appendChild(headerTr);
  table.appendChild(thead);

  // Body
  if (rows.length > 1) {
    const tbody = document.createElement("tbody");
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const tr = document.createElement("tr");
      const dataCells = "children" in row && Array.isArray(row.children) ? row.children : [];
      for (const cell of dataCells) {
        const td = document.createElement("td");
        td.textContent = extractCellText(cell);
        td.style.border = "1px solid #ddd";
        td.style.padding = "8px 12px";
        td.style.textAlign = "left";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }

  return table;
}

const SEPARATOR_RE = /^\|?\s*[-:]+\s*(\|\s*[-:]+\s*)*\|?\s*$/;

const LIST_MARKER_RE = /^(\s*)([-*+]|\d+[.)]) /;
const CHECKBOX_RE = /^\[([ xX])\] /;

function buildListDecorations(
  range: { from: number; to: number; node: List },
  doc: string,
  decos: Range<Decoration>[]
): void {
  const source = doc.slice(range.from, range.to);
  const lines = source.split("\n");
  let offset = range.from;
  const isOrdered = range.node.ordered === true;
  let orderNum = range.node.start ?? 1;

  for (const line of lines) {
    const lineEnd = offset + line.length;
    const markerMatch = LIST_MARKER_RE.exec(line);

    if (markerMatch) {
      const indent = markerMatch[1];
      const marker = markerMatch[2];
      const markerStart = offset + indent.length;
      const markerEnd = offset + markerMatch[0].length;

      // Replace the marker (- or 1.) with a styled bullet/number
      const bullet = document.createElement("span");
      if (isOrdered) {
        bullet.textContent = `${orderNum}. `;
        bullet.style.color = "#888";
        orderNum++;
      } else {
        bullet.textContent = "\u2022 ";
        bullet.style.color = "#888";
      }
      decos.push(
        Decoration.replace({ widget: createWidget(bullet) }).range(markerStart, markerEnd)
      );

      // Check for task list checkbox after the marker
      const afterMarker = line.slice(markerMatch[0].length);
      const checkMatch = CHECKBOX_RE.exec(afterMarker);
      if (checkMatch) {
        const checkStart = markerEnd;
        const checkEnd = markerEnd + checkMatch[0].length;
        const isChecked = checkMatch[1] !== " ";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isChecked;
        checkbox.disabled = true;
        checkbox.style.marginRight = "4px";
        checkbox.style.verticalAlign = "middle";

        decos.push(
          Decoration.replace({ widget: createWidget(checkbox) }).range(checkStart, checkEnd)
        );

        // Strikethrough completed items
        if (isChecked && checkEnd < lineEnd) {
          decos.push(
            Decoration.mark({
              attributes: { style: "text-decoration: line-through; color: #999" }
            }).range(checkEnd, lineEnd)
          );
        }
      }
    }

    offset = lineEnd + 1;
  }
}

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
    } else if (range.node.type === "table") {
      // Tables always render as widget with swallowEvents=true
      // so clicks don't break CM6 cursor positioning
      const tableEl = config.renderers.table
        ? renderLivePreviewNode(range.node, range.source, config.renderers)
        : renderTableWidget(range.node);
      decos.push(
        Decoration.replace({
          widget: createWidget(tableEl, true),
          block: true
        }).range(range.from, range.to)
      );
    } else if (range.node.type === "list") {
      buildListDecorations(
        range as { from: number; to: number; node: List },
        doc,
        decos
      );
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
      if (range.node.type === "heading" || range.node.type === "table" || range.node.type === "list") {
        parentSpans.push([range.from, range.to]);
      }

      const isBlock = BLOCK_NODE_TYPES.has(range.node.type);
      decos.push(
        Decoration.replace({
          widget: createWidget(
            renderLivePreviewNode(range.node, range.source, config.renderers),
            isBlock
          ),
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
