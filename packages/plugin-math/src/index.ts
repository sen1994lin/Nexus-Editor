import type { NexusPlugin } from "@floatboat/nexus-core";
import katex from "katex";
import remarkMath from "remark-math";

export function createMathPlugin(): NexusPlugin {
  return {
    name: "plugin-math",
    remarkPlugins: [remarkMath],
    widgets: [
      {
        nodeType: "math",
        render(node: any, source: string) {
          const container = document.createElement("div");
          container.className = "nexus-math-display";
          container.style.textAlign = "center";
          container.style.padding = "8px 0";
          try {
            katex.render(node.value ?? source, container, {
              displayMode: true,
              throwOnError: false,
            });
          } catch {
            container.textContent = source;
          }
          return container;
        },
      },
      {
        nodeType: "inlineMath",
        render(node: any, source: string) {
          const span = document.createElement("span");
          span.className = "nexus-math-inline";
          try {
            katex.render(node.value ?? source, span, {
              displayMode: false,
              throwOnError: false,
            });
          } catch {
            span.textContent = source;
          }
          return span;
        },
      },
    ],
  };
}
