import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@nexus/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@nexus/react": path.resolve(__dirname, "packages/react/src/index.ts")
    }
  },
  test: {
    environment: "jsdom"
  }
});
