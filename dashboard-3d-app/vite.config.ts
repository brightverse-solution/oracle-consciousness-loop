import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true, fs: { allow: ["..", "../../"] } },
  resolve: {
    preserveSymlinks: false,
    dedupe: ["react", "react-dom", "three"],
    alias: {
      three: resolve(__dirname, "node_modules/three"),
    },
  },
  optimizeDeps: {
    include: [
      "three",
      "three/examples/jsm/postprocessing/EffectComposer.js",
      "three/examples/jsm/postprocessing/RenderPass.js",
      "three/examples/jsm/postprocessing/UnrealBloomPass.js",
    ],
  },
});
