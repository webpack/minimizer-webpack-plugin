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

// `compiler.worker` arrived with webpack's `experiments.threads`.
const describeCompilerWorker =
  typeof webpack.Compiler.prototype.worker === "function"
    ? describe
    : describe.skip;

describeCompilerWorker("compiler.worker", () => {
  beforeEach(() => {
    Worker.mockClear();
  });

  it("minifies on webpack's pool when experiments.threads is on", async () => {
    const inline = getCompiler();

    new MinimizerPlugin({ parallel: false }).apply(inline);

    const expected = readsAssets(inline, await compile(inline));

    const compiler = getCompiler({ experiments: { threads: { max: 2 } } });
    const workerSpy = jest.spyOn(compiler, "worker");

    new MinimizerPlugin().apply(compiler);

    try {
      const stats = await compile(compiler);
      const pool = compiler._getWorkerPool();

      expect(readsAssets(compiler, stats)).toEqual(expected);
      expect(getErrors(stats)).toEqual([]);
      expect(getWarnings(stats)).toEqual([]);
      expect(Worker).not.toHaveBeenCalled();
      expect(workerSpy).toHaveBeenCalledWith(require.resolve("../src/minify"));
      expect(pool.stats.spawned).toBeGreaterThan(0);
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

  it("keeps jest-worker while experiments.threads is off", async () => {
    Worker.mockImplementation((workerPath) => ({
      minify: (data) => require(workerPath).minify(data),
      transform: (data) => require(workerPath).transform(data),
      end: jest.fn(),
      getStdout: jest.fn(),
      getStderr: jest.fn(),
    }));

    const compiler = getCompiler();

    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(Worker).toHaveBeenCalledTimes(1);
  });
});

// Runs on any webpack: the stub stands in for `compiler.worker()`.
describe("compiler.worker (stubbed)", () => {
  beforeEach(() => {
    Worker.mockClear();
  });

  it("sends minify calls to compiler.worker when experiments.threads is on", async () => {
    const inline = getCompiler();

    new MinimizerPlugin({ parallel: false }).apply(inline);

    const expected = readsAssets(inline, await compile(inline));

    const compiler = getCompiler();
    const run = jest.fn((method, ...args) =>
      require("../src/minify")[method](...args),
    );

    compiler.worker = jest.fn(() => ({ run }));
    compiler.options.experiments.threads = true;

    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toEqual(expected);
    expect(getErrors(stats)).toEqual([]);
    expect(Worker).not.toHaveBeenCalled();
    expect(compiler.worker).toHaveBeenCalledTimes(1);
    expect(compiler.worker).toHaveBeenCalledWith(
      require.resolve("../src/minify"),
    );
    expect(run).toHaveBeenCalled();
    expect(run.mock.calls.every(([method]) => method === "minify")).toBe(true);
  });

  it("keeps jest-worker when compiler.worker exists but threads are off", async () => {
    Worker.mockImplementation((workerPath) => ({
      minify: (data) => require(workerPath).minify(data),
      transform: (data) => require(workerPath).transform(data),
      end: jest.fn(),
      getStdout: jest.fn(),
      getStderr: jest.fn(),
    }));

    const compiler = getCompiler();

    compiler.worker = jest.fn();

    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(compiler.worker).not.toHaveBeenCalled();
    expect(Worker).toHaveBeenCalledTimes(1);
  });
});
