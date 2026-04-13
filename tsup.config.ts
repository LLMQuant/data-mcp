import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  clean: true,
  dts: false,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
