import path from "path";
import { fileURLToPath } from "url";

import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import outputSize from "rollup-plugin-output-size";
import { visualizer } from "rollup-plugin-visualizer";
import jsonPlugin from "@rollup/plugin-json";

import { buildRollupInput, getAllPackageInfo } from "./package-helper.mjs";
import { buildImportMapScript } from "./import-map.mjs";

const nodePlugin = nodeResolve({ browser: true });

function isExternal(id, parentId, isResolved) {
  const isExternal = id.includes("lucid-cardano") || id.includes("@marlowe.io");
  // console.error(
  //   `id: ${id}, parentId: ${parentId}, isResolved: ${isResolved}, isExternal ${isExternal}`
  // );
  return isExternal;
}

const plugins = [nodePlugin, commonjs(), jsonPlugin(), outputSize(), visualizer()];

const packageConfig = (format) => (packageInfo) => {
  const suffix = format == "cjs" ? "cjs" : "js";
  return {
    input: buildRollupInput(packageInfo),
    external: isExternal,
    output: {
      dir: path.join(packageInfo.location, "dist", "bundled", format),
      format: format,
      entryFileNames: `[name].${suffix}`,
      chunkFileNames: `[name]-[hash].${suffix}`,
    },
    plugins,
  };
};

const packagesInfo = await getAllPackageInfo();

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

await buildImportMapScript(packagesInfo, { type: "local" }, path.join(projectRoot, "dist"));
await buildImportMapScript(packagesInfo, { type: "jsdelivr-npm", version: "0.4.0-beta-rc1" }, projectRoot);
// This is for testing purposes only, search [[Publish pre-check]]
await buildImportMapScript(
  packagesInfo,
  { type: "jsdelivr-gh", owner: "hrajchert", version: "126dfc25b8ae524f5bad1707fd20b4568be3f6ef" },
  path.join(projectRoot, "dist")
);

const config = [
  ...packagesInfo.map(packageConfig("esm")),
  // Search [[CommonJS exports problem]]
  ...packagesInfo.map(packageConfig("cjs")),
];
export default config;
