/**
 * Picks webpack's own `webpack-sources` when it carries `util.sourceMap`
 * (3.7.0 and later), else this plugin's copy, which an older webpack needs.
 * @param {typeof import("webpack").sources=} sources webpack's sources, `compiler.webpack.sources` where a compiler is at hand
 * @returns {typeof import("webpack-sources")} sources with `util.sourceMap`
 */
export function getSources(
  sources?: typeof import("webpack").sources | undefined,
): typeof import("webpack-sources");
