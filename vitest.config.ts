import { defineConfig } from "vitest/config";

const projectRoot = new URL(".", import.meta.url).pathname;

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      // next/font/google is a bundler macro; swap in a stub so app/layout.tsx can be imported
      "next/font/google": `${projectRoot}tests/stubs/next-font-google.ts`,
      "@": projectRoot
    }
  }
});
