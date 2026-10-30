/** @typedef {import("./index.js").RawSourceMap} RawSourceMap */

/**
 * @typedef {object} OriginalPosition
 * @property {string} source source the position maps back to
 * @property {number} line 1-based line
 * @property {number} column 0-based column
 * @property {string | null} name name at the position, if any
 */

/**
 * @typedef {object} SourceMapUtil
 * @property {(sourceMap: RawSourceMap, line: number, column: number) => OriginalPosition | null} originalPositionFor finds the original position of a generated one
 */

/**
 * webpack's own `webpack-sources`. Where no compiler is at hand, as in a
 * worker, it is the installed webpack's.
 * @param {typeof import("webpack").sources=} sources `compiler.webpack.sources`
 * @returns {typeof import("webpack").sources} webpack's sources
 */
function getSources(sources = require("webpack").sources) {
  return sources;
}

/**
 * Source map helpers from webpack's `webpack-sources`, which has them from
 * 3.7.0. An older webpack-sources has none, and `undefined` is returned.
 * @param {typeof import("webpack").sources=} sources `compiler.webpack.sources`
 * @returns {SourceMapUtil | undefined} source map helpers
 */
function getSourceMapUtil(sources) {
  const { util } =
    /** @type {{ util?: { sourceMap?: SourceMapUtil } }} */
    (/** @type {unknown} */ (getSources(sources)));

  // TODO drop the check in the next major release, when the minimum webpack
  // ships webpack-sources >= 3.7.0.
  return util && util.sourceMap;
}

module.exports = { getSourceMapUtil, getSources };
