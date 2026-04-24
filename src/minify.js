/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */
/** @typedef {import("./index.js").CustomOptions} CustomOptions */
/** @typedef {import("./index.js").RawSourceMap} RawSourceMap */

/**
 * @template T
 * @param {import("./index.js").InternalOptions<T>} options options
 * @returns {Promise<MinimizedResult>} minified result
 */
async function minify(options) {
  const { name, input, inputSourceMap, extractComments } = options;
  const { implementation, options: minimizerOptions } = options.minimizer;
  const implementations = Array.isArray(implementation)
    ? implementation
    : [implementation];

  /** @type {string | undefined} */
  let code;
  /** @type {RawSourceMap | undefined} */
  let map;
  /** @type {(Error | string)[]} */
  const warnings = [];
  /** @type {(Error | string)[]} */
  const errors = [];
  /** @type {string[]} */
  const extractedComments = [];

  let currentInput =
    /** @type {string | undefined} */
    (input);
  let currentMap = inputSourceMap;

  for (let i = 0; i < implementations.length; i++) {
    const currentImplementation =
      /** @type {import("./index.js").BasicMinimizerImplementation<T> & import("./index.js").MinimizeFunctionHelpers} */
      (implementations[i]);
    const currentOptions =
      /** @type {import("./index.js").MinimizerOptions<T>} */
      (
        Array.isArray(minimizerOptions) ? minimizerOptions[i] : minimizerOptions
      );

    const result = await currentImplementation(
      { [name]: /** @type {string} */ (currentInput) },
      currentMap,
      currentOptions,
      extractComments,
    );

    if (result.warnings && result.warnings.length > 0) {
      warnings.push(...result.warnings);
    }

    if (result.errors && result.errors.length > 0) {
      errors.push(...result.errors);
    }

    if (result.extractedComments && result.extractedComments.length > 0) {
      extractedComments.push(...result.extractedComments);
    }

    code = result.code;
    map = result.map;

    // Stop chaining if a minimizer didn't produce code
    if (typeof code !== "string") {
      break;
    }

    currentInput = code;
    currentMap = map;
  }

  return { code, map, warnings, errors, extractedComments };
}

/**
 * @param {string} options options
 * @returns {Promise<MinimizedResult>} minified result
 */
async function transform(options) {
  // 'use strict' => this === undefined (Clean Scope)
  // Safer for possible security issues, albeit not critical at all here

  const evaluatedOptions =
    /**
     * @template T
     * @type {import("./index.js").InternalOptions<T>}
     */
    (
      // eslint-disable-next-line no-new-func
      new Function(
        "exports",
        "require",
        "module",
        "__filename",
        "__dirname",
        `'use strict'\nreturn ${options}`,
        // eslint-disable-next-line n/exports-style
      )(exports, require, module, __filename, __dirname)
    );

  return minify(evaluatedOptions);
}

module.exports = { minify, transform };
