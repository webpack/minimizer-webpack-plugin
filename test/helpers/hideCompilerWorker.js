import webpack from "webpack";

/**
 * Hides `compiler.worker()`, so the plugin takes the jest-worker path it keeps
 * for webpack without it and for minimizers that need child processes.
 * @returns {() => void} restores `compiler.worker()`
 */
export default function hideCompilerWorker() {
  const { prototype } = webpack.Compiler;
  const had = Object.prototype.hasOwnProperty.call(prototype, "worker");
  const { worker } = prototype;

  prototype.worker = undefined;

  return () => {
    if (had) {
      prototype.worker = worker;
    } else {
      delete prototype.worker;
    }
  };
}
