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
 * Whether a value holds a function anywhere inside it. A worker reached by
 * module path is handed the payload as it is, and a structured clone throws on
 * one rather than dropping it.
 * @param {unknown} value what a worker would be handed
 * @param {Set<unknown>=} seen values already walked
 * @returns {boolean} true when a function is in there
 */
function holdsFunction(value, seen = new Set()) {
  if (typeof value === "function") {
    return true;
  }

  if (!value || typeof value !== "object" || seen.has(value)) {
    return false;
  }

  seen.add(value);

  // A structured clone carries a `Map` or a `Set` but not what it holds, and
  // neither answers to `Object.values`.
  if (value instanceof Map) {
    return [...value].some(
      ([key, one]) => holdsFunction(key, seen) || holdsFunction(one, seen),
    );
  }

  if (value instanceof Set) {
    return [...value].some((one) => holdsFunction(one, seen));
  }

  return Object.values(/** @type {Record<string, unknown>} */ (value)).some(
    (one) => holdsFunction(one, seen),
  );
}

/**
 * Whether a value holds a regular expression anywhere inside it.
 * Child-process workers on runtimes without worker threads use the default
 * process IPC serializer, which does not preserve regular expressions.
 * @param {unknown} value what a worker would be handed
 * @param {Set<unknown>=} seen values already walked
 * @returns {boolean} true when a regular expression is in there
 */
function holdsRegExp(value, seen = new Set()) {
  if (value instanceof RegExp) {
    return true;
  }
  if (!value || typeof value !== "object" || seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (value instanceof Map) {
    return [...value].some(
      ([key, one]) => holdsRegExp(key, seen) || holdsRegExp(one, seen),
    );
  }
  if (value instanceof Set) {
    return [...value].some((one) => holdsRegExp(one, seen));
  }
  return Object.values(/** @type {Record<string, unknown>} */ (value)).some(
    (one) => holdsRegExp(one, seen),
  );
}

/**
 * True when every `minimizer.implementation` is a module path (`string` or
 * `{ path, export }`). Inline minify functions keep `transform`. When
 * `embedded` is present, *every* configured implementation must be a path —
 * a single inline function in the embedded set forces `transform` for the
 * whole asset task, even if that asset's own matched minimizers are paths.
 * @template T
 * @param {import("./index.js").InternalOptions<T>} options options
 * @param {{ enableWorkerThreads?: boolean }=} capabilities worker capabilities
 * @returns {boolean} whether `worker.minify` can run without `transform`
 */
function canMinifyByPath(options, capabilities = {}) {
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

  // `extractComments` and a minimizer's own options both take functions, and
  // those only ever reached a worker as source.
  if (
    holdsFunction(options.extractComments) ||
    holdsFunction(options.minimizer.options)
  ) {
    return false;
  }
  if (
    capabilities.enableWorkerThreads === false &&
    (holdsRegExp(options.extractComments) ||
      holdsRegExp(options.minimizer.options))
  ) {
    return false;
  }

  if (!options.embedded) {
    return true;
  }

  if (holdsFunction(options.embedded.options)) {
    return false;
  }
  if (
    capabilities.enableWorkerThreads === false &&
    holdsRegExp(options.embedded.options)
  ) {
    return false;
  }

  const embedded = Array.isArray(options.embedded.implementation)
    ? options.embedded.implementation
    : [options.embedded.implementation];

  return embedded.every(hasPath);
}

/**
 * The file `loadImplementation` would `require`, which is what tells two
 * references apart: a bare specifier and a file of that name are not one module.
 * @param {unknown} implementation a minify function, module path, or path ref
 * @returns {string | undefined} its resolved module, or nothing where no module is named
 */
function resolveImplementationModule(implementation) {
  const ref = getImplementationModuleRef(implementation);

  return ref ? require.resolve(ref.path) : undefined;
}

module.exports = {
  canMinifyByPath,
  getImplementationModuleRef,
  loadImplementation,
  resolveImplementationModule,
};
