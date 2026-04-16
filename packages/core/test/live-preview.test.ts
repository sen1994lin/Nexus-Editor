import { describe, expect, it } from "vitest";

import { createGfmPreset } from "../../preset-gfm/src/index";
import { createEditor } from "../src/index";

describe("live preview", () => {
  it("renders inline markdown nodes when the cursor is outside the syntax range", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text **bold** *italic* `code` [link](https://example.com)",
      livePreview: true
    });

    // Inline text should be visible, markers hidden via Decoration.replace
    const text = container.textContent ?? "";
    expect(text).toContain("bold");
    expect(text).toContain("italic");
    expect(text).toContain("code");
    expect(text).toContain("link");
    // Markers should be hidden
    expect(text).not.toContain("**");
    editor.destroy();
  });

  it("restores raw markdown when the cursor enters a live preview range", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text **bold**",
      livePreview: true
    });

    const text1 = container.textContent ?? "";
    expect(text1).toContain("bold");
    expect(text1).not.toContain("**");

    editor.setSelection(8);

    // When cursor is inside, raw markdown should be visible
    expect(container.textContent).toContain("**bold**");
    editor.destroy();
  });

  it("renders headings, blockquotes, and images as block previews", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Intro\n\n# Heading\n\n> Quote\n\n![Alt](https://example.com/image.png)",
      livePreview: true
    });

    expect(container.querySelector("[data-heading-level='1']")?.textContent).toBe("Heading");
    expect(container.querySelector("blockquote")?.textContent).toBe("Quote");
    expect(container.querySelector("[data-live-preview-image]")?.getAttribute("data-live-preview-image")).toBe(
      "https://example.com/image.png"
    );
    editor.destroy();
  });

  it("renders strikethrough with line-through when GFM is enabled", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text ~~deleted~~",
      livePreview: true,
      plugins: [createGfmPreset()]
    });

    const text = container.textContent ?? "";
    expect(text).toContain("deleted");
    expect(text).not.toContain("~~");
    editor.destroy();
  });

  it("renders thematic break as hr element", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text\n\n---\n\nMore",
      livePreview: true
    });

    expect(container.querySelector("hr")).not.toBeNull();
    editor.destroy();
  });

  it("renders fenced code blocks with line decorations and syntax highlighting", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text\n\n```js\nconsole.log(1)\n```",
      livePreview: true
    });

    expect(container.textContent).toContain("console.log(1)");
    // Language label is capitalized in view mode
    expect(container.textContent).toContain("Js");
    editor.destroy();
  });

  it("renders tables as editable widget with contenteditable cells", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
      livePreview: true,
      plugins: [createGfmPreset()]
    });

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    // First <th> is the row grip, second <th> is "A"
    const ths = table?.querySelectorAll("th");
    expect(ths!.length).toBeGreaterThanOrEqual(3);
    const headerA = ths![1]; // skip row grip
    expect(headerA?.textContent).toBe("A");
    expect(headerA?.classList.contains("nexus-cell")).toBe(true);
    editor.destroy();
  });

  it("allows host renderers to override default node rendering", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Intro\n\n# Heading",
      livePreview: {
        renderers: {
          heading({ text }) {
            const element = document.createElement("div");
            element.setAttribute("data-heading", "custom");
            element.textContent = text.toUpperCase();
            return element;
          }
        }
      }
    });

    expect(container.querySelector("[data-heading='custom']")?.textContent).toBe("HEADING");
    editor.destroy();
  });

  it("passes the raw markdown source into custom renderers", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text **bold**",
      livePreview: {
        renderers: {
          strong({ source }) {
            const element = document.createElement("span");
            element.setAttribute("data-source", source);
            return element;
          }
        }
      }
    });

    expect(container.querySelector("[data-source]")?.getAttribute("data-source")).toBe("**bold**");
    editor.destroy();
  });

  it("uses default renderers for node types that are not overridden", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text **bold** *italic*",
      livePreview: {
        renderers: {
          strong({ text }) {
            const element = document.createElement("span");
            element.textContent = text.toUpperCase();
            return element;
          }
        }
      }
    });

    expect(container.querySelector("span")?.textContent).toBe("BOLD");
    // italic uses default mark decoration — text should be visible without markers
    const text = container.textContent ?? "";
    expect(text).toContain("italic");
    expect(text).not.toContain("*italic*");
    editor.destroy();
  });

  it("re-renders live preview decorations after document updates", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text **bold**",
      livePreview: true
    });

    editor.setDocument("Text **changed**");

    const text = container.textContent ?? "";
    expect(text).toContain("changed");
    expect(text).not.toContain("**");
    editor.destroy();
  });
});
