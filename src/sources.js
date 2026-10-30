/**
 * Picks webpack's own `webpack-sources` when it carries `util.sourceMap`
 * (3.7.0 and later), else this plugin's copy, which an older webpack needs.
 * @param {typeof import("webpack").sources=} sources webpack's sources, `compiler.webpack.sources` where a compiler is at hand
 * @returns {typeof import("webpack-sources")} sources with `util.sourceMap`
 */
function getSources(sources = require("webpack").sources) {
  const candidate =
    /** @type {typeof import("webpack-sources")} */
    (/** @type {unknown} */ (sources));

  // TODO return `sources` in the next major release, when the minimum webpack
  // ships webpack-sources >= 3.7.0, and drop the `webpack-sources` dependency.
  return candidate.util && candidate.util.sourceMap
    ? candidate
    : require("webpack-sources");
}

module.exports = { getSources };
