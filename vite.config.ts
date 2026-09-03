import { defineConfig } from "vite";

export default defineConfig({
  base: "/metaxu/",
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
