export type MinimizedResult = import("./index.js").MinimizedResult;
export type CustomOptions = import("./index.js").CustomOptions;
export type MinimizeFunctionHelpers =
  import("./index.js").MinimizeFunctionHelpers;
export type ImplementationModuleRef =
  import("./index.js").ImplementationModuleRef;
export type MinimizerFn =
  import("./index.js").BasicMinimizerImplementation<CustomOptions> &
    MinimizeFunctionHelpers;
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
export function canMinifyByPath<T>(
  options: import("./index.js").InternalOptions<T>,
): boolean;
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
export function getImplementationModuleRef(
  implementation: unknown,
): ImplementationModuleRef | undefined;
/**
 * @param {unknown} implementation a minify function, module path, or path ref
 * @returns {MinimizerFn} the minify function
 */
export function loadImplementation(implementation: unknown): MinimizerFn;
