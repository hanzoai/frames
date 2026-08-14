import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const packageVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
  .version as string;

export default defineConfig({
  entry: ["src/frames-player.ts", "src/slideshow/frames-slideshow.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: "HyperframesPlayer",
  noExternal: ["@hanzo/frame-core"],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  define: {
    __FRAMES_RUNTIME_CDN_URL__: JSON.stringify(
      `https://cdn.jsdelivr.net/npm/@hanzo/frame-core@${packageVersion}/dist/hyperframe.runtime.iife.js`,
    ),
  },
});
