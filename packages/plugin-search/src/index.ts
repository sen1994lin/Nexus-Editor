import type { NexusPlugin } from "@floatboat/nexus-core";

export interface SearchMatch {
  from: number;
  to: number;
  text: string;
}

export interface SearchOptions {
  caseSensitive?: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findSearchMatches(
  doc: string,
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  if (!query) {
    return [];
  }

  const flags = options.caseSensitive ? "g" : "gi";
  const pattern = new RegExp(escapeRegExp(query), flags);
  const matches: SearchMatch[] = [];

  for (const match of doc.matchAll(pattern)) {
    const text = match[0];
    const from = match.index ?? 0;

    matches.push({
      from,
      to: from + text.length,
      text
    });
  }

  return matches;
}

export function replaceAllMatches(
  doc: string,
  query: string,
  replacement: string,
  options: SearchOptions = {}
): string {
  if (!query) {
    return doc;
  }

  const flags = options.caseSensitive ? "g" : "gi";
  return doc.replace(new RegExp(escapeRegExp(query), flags), replacement);
}

export function createSearchPlugin(): NexusPlugin {
  return {
    name: "plugin-search"
  };
}
