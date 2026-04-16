import { describe, expect, it } from "vitest";

import { createHistoryPlugin } from "../../plugin-history/src/index";
import { createEditor } from "../src/index";

describe("live preview regressions", () => {
  it("keeps live preview working when the history plugin is registered", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text **bold**",
      livePreview: true,
      plugins: [createHistoryPlugin()]
    });

    const content = container.querySelector("[contenteditable='true']");

    editor.setDocument("Text **changed**");
    content?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      })
    );

    const text = container.textContent ?? "";
    expect(text).toContain("bold");
    expect(text).not.toContain("**");
    editor.destroy();
  });

  it("restores preview after the cursor leaves a markdown range", () => {
    const container = document.createElement("div");
    const editor = createEditor({
      container,
      initialValue: "Text **bold** end",
      livePreview: true
    });

    editor.setSelection(8);
    // Cursor inside bold: raw markdown visible
    expect(container.textContent).toContain("**bold**");

    editor.setSelection(0);

    // Cursor left: markers hidden, text visible
    const text = container.textContent ?? "";
    expect(text).toContain("bold");
    expect(text).not.toContain("**");
    editor.destroy();
  });
});
