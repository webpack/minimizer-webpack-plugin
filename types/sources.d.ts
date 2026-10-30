export type RawSourceMap = import("./index.js").RawSourceMap;
export type OriginalPosition = {
  /**
   * source the position maps back to
   */
  source: string;
  /**
   * 1-based line
   */
  line: number;
  /**
   * 0-based column
   */
  column: number;
  /**
   * name at the position, if any
   */
  name: string | null;
};
export type SourceMapUtil = {
  /**
   * finds the original position of a generated one
   */
  originalPositionFor: (
    sourceMap: RawSourceMap,
    line: number,
    column: number,
  ) => OriginalPosition | null;
};
/**
 * Source map helpers from webpack's `webpack-sources`, which has them from
 * 3.7.0. An older webpack-sources has none, and `undefined` is returned.
 * @param {typeof import("webpack").sources=} sources `compiler.webpack.sources`
 * @returns {SourceMapUtil | undefined} source map helpers
 */
export function getSourceMapUtil(
  sources?: typeof import("webpack").sources | undefined,
): SourceMapUtil | undefined;
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
export function getSources(
  sources?: typeof import("webpack").sources | undefined,
): typeof import("webpack").sources;
