import { defineConfig } from "vite";

export default defineConfig({
  base: "/metaxu/",
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
