import normalizeBuildOutput from "./normalizeBuildOutput";
import readAsset from "./readAsset";

/**
 * @param {import("webpack").Compiler} compiler compiler
 * @param {import("webpack").Stats} stats stats
 * @returns {Record<string, string>} assets
 */
export default function readAssets(compiler, stats) {
  const assets = {};

  for (const asset of Object.keys(stats.compilation.assets)) {
    assets[normalizeBuildOutput(asset)] = normalizeBuildOutput(
      readAsset(asset, compiler, stats),
    );
  }

  return assets;
}
