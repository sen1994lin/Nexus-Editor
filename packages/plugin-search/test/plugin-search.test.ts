import { describe, expect, it } from "vitest";
import {
  createSearchPlugin,
  findSearchMatches,
  replaceAllMatches
} from "../src/index";

describe("@floatboat/nexus-plugin-search", () => {
  it("finds all case-insensitive matches in a document", () => {
    expect(findSearchMatches("Hello hello HELLO", "hello")).toEqual([
      { from: 0, to: 5, text: "Hello" },
      { from: 6, to: 11, text: "hello" },
      { from: 12, to: 17, text: "HELLO" }
    ]);
  });

  it("supports case-sensitive search", () => {
    expect(findSearchMatches("Hello hello HELLO", "hello", { caseSensitive: true })).toEqual([
      { from: 6, to: 11, text: "hello" }
    ]);
  });

  it("replaces all matches in a document", () => {
    expect(replaceAllMatches("cat scatter cat", "cat", "dog")).toBe("dog sdogter dog");
  });

  it("creates a search plugin descriptor", () => {
    expect(createSearchPlugin()).toEqual({
      name: "plugin-search"
    });
  });
});
