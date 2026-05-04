export type MinimizedResult = import("./index.js").MinimizedResult;
export type CustomOptions = import("./index.js").CustomOptions;
export type RawSourceMap = import("./index.js").RawSourceMap;
export type MinimizerOptions<T> = import("./index.js").MinimizerOptions<T>;
/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */
/** @typedef {import("./index.js").CustomOptions} CustomOptions */
/** @typedef {import("./index.js").RawSourceMap} RawSourceMap */
/**
 * @template T
 * @typedef {import("./index.js").MinimizerOptions<T>} MinimizerOptions
 */
/**
 * @template T
 * @param {import("./index.js").InternalOptions<T>} options options
 * @returns {Promise<MinimizedResult>} minified result
 */
export function minify<T>(
  options: import("./index.js").InternalOptions<T>,
): Promise<MinimizedResult>;
/**
 * @param {string} options options
 * @returns {Promise<MinimizedResult>} minified result
 */
export function transform(options: string): Promise<MinimizedResult>;
