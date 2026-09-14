/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */
/** @typedef {import("./index.js").CustomOptions} CustomOptions */
/** @typedef {import("./index.js").MinimizeFunctionHelpers} MinimizeFunctionHelpers */
/** @typedef {import("./index.js").ImplementationModuleRef} ImplementationModuleRef */
/**
 * @typedef {import("./index.js").BasicMinimizerImplementation<CustomOptions> & MinimizeFunctionHelpers} MinimizerFn
 */

/**
 * @param {unknown} implementation a minify function, module path, or path ref
 * @returns {ImplementationModuleRef | undefined} how to `require` it in a worker
 */
function getImplementationModuleRef(implementation) {
  if (typeof implementation === "string") {
    return { path: implementation };
  }

  if (
    implementation &&
    typeof implementation === "object" &&
    typeof (/** @type {ImplementationModuleRef} */ (implementation).path) ===
      "string"
  ) {
    const ref = /** @type {ImplementationModuleRef} */ (implementation);

    return typeof ref.export === "string" && ref.export.length > 0
      ? { path: ref.path, export: ref.export }
      : { path: ref.path };
  }

  return undefined;
}

/**
 * @param {unknown} implementation a minify function, module path, or path ref
 * @returns {MinimizerFn} the minify function
 */
function loadImplementation(implementation) {
  if (typeof implementation === "function") {
    return /** @type {MinimizerFn} */ (implementation);
  }

  const ref = getImplementationModuleRef(implementation);

  if (!ref) {
    throw new TypeError(
      "Invalid minimizer implementation: expected a function, module path string, or { path, export }",
    );
  }

  const mod = require(ref.path);

  const loaded =
    typeof ref.export === "string"
      ? mod[ref.export]
      : typeof mod === "function"
        ? mod
        : mod && mod.default;

  if (typeof loaded !== "function") {
    throw new TypeError(
      typeof ref.export === "string"
        ? `Minimizer export "${ref.export}" is not a function in ${ref.path}`
        : `Minimizer module does not export a function: ${ref.path}`,
    );
  }

  return /** @type {MinimizerFn} */ (loaded);
}

/**
 * True when every `minimizer.implementation` is a module path (`string` or
 * `{ path, export }`). Inline minify functions keep `transform`. When
 * `embedded` is present, *every* configured implementation must be a path —
 * a single inline function in the embedded set forces `transform` for the
 * whole asset task, even if that asset's own matched minimizers are paths.
 * @template T
 * @param {import("./index.js").InternalOptions<T>} options options
 * @returns {boolean} whether `worker.minify` can run without `transform`
 */
function canMinifyByPath(options) {
  /**
   * @param {unknown} implementation implementation
   * @returns {boolean} true when a module path is known
   */
  const hasPath = (implementation) =>
    Boolean(getImplementationModuleRef(implementation));

  const minimizers = Array.isArray(options.minimizer.implementation)
    ? options.minimizer.implementation
    : [options.minimizer.implementation];

  if (!minimizers.every(hasPath)) {
    return false;
  }

  if (!options.embedded) {
    return true;
  }

  const embedded = Array.isArray(options.embedded.implementation)
    ? options.embedded.implementation
    : [options.embedded.implementation];

  return embedded.every(hasPath);
}

module.exports = {
  canMinifyByPath,
  getImplementationModuleRef,
  loadImplementation,
};
