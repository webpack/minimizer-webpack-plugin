import { Worker } from "jest-worker";
import webpack from "webpack";

import MinimizerPlugin from "../src/index";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

jest.mock("jest-worker", () => ({ Worker: jest.fn() }));

// The plugin takes webpack's pool only where `worker_threads` loads (not on
// Node 10 without a flag); elsewhere it keeps jest-worker.
const describeWithThreads = (() => {
  try {
    require("worker_threads");
    return describe;
  } catch (_error) {
    return describe.skip;
  }
})();

/**
 * One-CPU hosts compute zero parallel workers and skip the worker branch, so
 * pin a positive count while the plugin reads it in `apply`.
 * @param {MinimizerPlugin} plugin the plugin
 * @param {import("webpack").Compiler} compiler the compiler
 */
const applyWithCores = (plugin, compiler) => {
  const cores = jest
    .spyOn(MinimizerPlugin, "getAvailableNumberOfCores")
    .mockReturnValue(2);

  try {
    plugin.apply(compiler);
  } finally {
    cores.mockRestore();
  }
};

describe("compiler.worker", () => {
  // `compiler.worker` arrived with webpack's `experiments.threads`.
  const describeCompilerWorker =
    typeof webpack.Compiler.prototype.worker === "function"
      ? describe
      : describe.skip;

  describeCompilerWorker("real", () => {
    beforeEach(() => {
      Worker.mockClear();
    });

    it("minifies on webpack's pool when experiments.threads is on", async () => {
      const inline = getCompiler();

      new MinimizerPlugin({ parallel: false }).apply(inline);

      const expected = readsAssets(inline, await compile(inline));

      const compiler = getCompiler({ experiments: { threads: { max: 2 } } });
      const workerSpy = jest.spyOn(compiler, "worker");

      applyWithCores(new MinimizerPlugin(), compiler);

      try {
        const stats = await compile(compiler);
        const pool = compiler._getWorkerPool();

        expect(readsAssets(compiler, stats)).toEqual(expected);
        expect(getErrors(stats)).toEqual([]);
        expect(getWarnings(stats)).toEqual([]);
        expect(Worker).not.toHaveBeenCalled();
        expect(workerSpy).toHaveBeenCalledWith(
          require.resolve("../src/minify"),
          { numWorkers: expect.any(Number) },
        );
        // a one-CPU host gets an inline pool (`max: 0`)
        if (pool.options.max > 0) {
          expect(pool.stats.spawned).toBeGreaterThan(0);
        }
        expect(pool.stats.spawned).toBeLessThanOrEqual(2);

        // the next build runs on the same threads
        const { spawned } = pool.stats;

        await compile(compiler);

        expect(pool.stats.spawned).toBe(spawned);
        expect(Worker).not.toHaveBeenCalled();
      } finally {
        await new Promise((resolve, reject) => {
          compiler.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });

    it("minifies on webpack's threads while experiments.threads is off", async () => {
      const inline = getCompiler();

      new MinimizerPlugin({ parallel: false }).apply(inline);

      const expected = readsAssets(inline, await compile(inline));

      const compiler = getCompiler();

      applyWithCores(new MinimizerPlugin(), compiler);

      try {
        const stats = await compile(compiler);

        expect(readsAssets(compiler, stats)).toEqual(expected);
        expect(getErrors(stats)).toEqual([]);
        expect(Worker).not.toHaveBeenCalled();

        const { _pool: pool } = compiler.worker(
          require.resolve("../src/minify"),
          { numWorkers: 2 },
        );

        // the configured pool stays inline; the minimizer's runs on threads,
        // unless worker_threads or a second CPU is missing
        expect(pool).not.toBe(compiler._getWorkerPool());
        expect(pool.stats.spawned).toBeLessThanOrEqual(2);
      } finally {
        await new Promise((resolve, reject) => {
          compiler.close((error) => (error ? reject(error) : resolve()));
        });
      }
    });
  });

  // Runs on any webpack: the stub stands in for `compiler.worker()`.
  describe("stubbed", () => {
    beforeEach(() => {
      Worker.mockClear();
    });

    describeWithThreads("with worker_threads", () => {
      it("sends minify calls to compiler.worker with numWorkers", async () => {
        const inline = getCompiler();

        new MinimizerPlugin({ parallel: false }).apply(inline);

        const expected = readsAssets(inline, await compile(inline));

        const compiler = getCompiler();
        const run = jest.fn((method, ...args) =>
          require("../src/minify")[method](...args),
        );

        Object.assign(compiler, { worker: jest.fn(() => ({ run })) });

        applyWithCores(new MinimizerPlugin(), compiler);

        const stats = await compile(compiler);

        expect(readsAssets(compiler, stats)).toEqual(expected);
        expect(getErrors(stats)).toEqual([]);
        expect(Worker).not.toHaveBeenCalled();
        expect(compiler.worker).toHaveBeenCalledTimes(1);
        expect(compiler.worker).toHaveBeenCalledWith(
          require.resolve("../src/minify"),
          { numWorkers: expect.any(Number) },
        );
        expect(run).toHaveBeenCalled();
        expect(run.mock.calls.every(([method]) => method === "minify")).toBe(
          true,
        );
      });

      it("sends an inline minify function through transform", async () => {
        // serialized as source for `transform`, so it must not close over anything
        const impl = (input) => ({ code: Object.values(input)[0] });

        const compiler = getCompiler();
        const run = jest.fn((method, ...args) =>
          require("../src/minify")[method](...args),
        );

        Object.assign(compiler, { worker: jest.fn(() => ({ run })) });

        applyWithCores(new MinimizerPlugin({ minify: impl }), compiler);

        const stats = await compile(compiler);

        expect(getErrors(stats)).toEqual([]);
        expect(Worker).not.toHaveBeenCalled();
        expect(run).toHaveBeenCalledTimes(
          Object.keys(stats.compilation.assets).length,
        );
        expect(run.mock.calls.every(([method]) => method === "transform")).toBe(
          true,
        );
      });
    });

    /**
     * @param {string} workerPath the module jest-worker would load
     * @returns {{ minify: (data: EXPECTED_ANY) => EXPECTED_ANY, transform: (data: string) => EXPECTED_ANY, end: () => void, getStdout: () => void, getStderr: () => void }} a jest-worker stand-in that runs calls here
     */
    const fakeJestWorker = (workerPath) => ({
      minify: (data) => require(workerPath).minify(data),
      transform: (data) => require(workerPath).transform(data),
      end: jest.fn(),
      getStdout: jest.fn(),
      getStderr: jest.fn(),
    });

    describeWithThreads("child-process minimizers", () => {
      it("sends a minimizer that needs child processes to compiler.worker too", async () => {
        // serialized as source for `transform`, so it must not close over anything
        const impl = (input) => ({ code: Object.values(input)[0] });

        impl.supportsWorkerThreads = () => false;

        const compiler = getCompiler();
        const run = jest.fn((method, ...args) =>
          require("../src/minify")[method](...args),
        );

        Object.assign(compiler, { worker: jest.fn(() => ({ run })) });

        applyWithCores(new MinimizerPlugin({ minify: impl }), compiler);

        const stats = await compile(compiler);

        expect(getErrors(stats)).toEqual([]);
        expect(Worker).not.toHaveBeenCalled();
        expect(compiler.worker).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalled();
      });
    });

    it("keeps jest-worker on webpack without compiler.worker", async () => {
      Worker.mockImplementation(fakeJestWorker);

      const compiler = getCompiler();

      Object.assign(compiler, { worker: undefined });

      applyWithCores(new MinimizerPlugin(), compiler);

      const stats = await compile(compiler);

      expect(getErrors(stats)).toEqual([]);
      expect(Worker).toHaveBeenCalledTimes(1);
    });
  });
});
