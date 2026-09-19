import path from "path";
import zlib from "zlib";

import { Worker } from "jest-worker";

import MinimizerPlugin from "../src/index";
import { terserMinify } from "../src/utils.js";

import { compile, getCompiler, getErrors, getWarnings } from "./helpers";

jest.mock("os", () => {
  const actualOs = jest.requireActual("os");
  const isAvailableParallelism =
    typeof actualOs.availableParallelism !== "undefined";

  const mocked = {
    availableParallelism: isAvailableParallelism ? jest.fn(() => 4) : undefined,
    cpus: jest.fn(() => ({ length: 4 })),
  };

  return { ...actualOs, ...mocked };
});

// What the pools did and when, so "no extra threads" is a sequence rather
// than a count: a pool still running when the next one starts shows up here.
let mockLifetime = [];

jest.mock("jest-worker", () => ({
  Worker: jest.fn().mockImplementation((workerPath) => {
    const at = mockLifetime.filter((event) =>
      event.startsWith("start:"),
    ).length;

    mockLifetime.push(`start:${at}`);

    return {
      transform: jest.fn((data) => require(workerPath).transform(data)),
      end: jest.fn(() => {
        mockLifetime.push(`end:${at}`);
      }),
      getStderr: jest.fn(),
      getStdout: jest.fn(),
    };
  }),
}));

/**
 * @param {import("webpack").Compiler} compiler compiler
 * @param {import("webpack").Stats} stats stats
 * @param {string} name asset name
 * @returns {Buffer} its emitted bytes
 */
const readBytes = (compiler, stats, name) =>
  compiler.outputFileSystem.readFileSync(
    path.join(stats.compilation.outputOptions.path, name),
  );

/**
 * Whether every pool was ended before the next one started, which is what
 * keeps a second pass from adding threads to a first one still running.
 * @returns {boolean} true when none overlapped
 */
const neverOverlapped = () => {
  let running = 0;

  for (const event of mockLifetime) {
    running += event.startsWith("start:") ? 1 : -1;

    if (running > 1) {
      return false;
    }
  }

  return true;
};

describe("parallel across stages", () => {
  let compiler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLifetime = [];

    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/entry.js"),
        two: path.resolve(__dirname, "./fixtures/entry.js"),
        three: path.resolve(__dirname, "./fixtures/entry.js"),
        four: path.resolve(__dirname, "./fixtures/entry.js"),
      },
    });
  });

  it("should keep one pool when `compress` minifies beside a worker minimizer", async () => {
    new MinimizerPlugin({
      minify: [terserMinify, MinimizerPlugin.compress],
      minimizerOptions: [{}, { algorithm: "gzip" }],
    }).apply(compiler);

    const stats = await compile(compiler);

    // The two run a stage apart, and only one of them can reach a worker, so
    // the extra pass costs no pool at all.
    expect(Worker).toHaveBeenCalledTimes(1);
    expect(neverOverlapped()).toBe(true);
    expect(mockLifetime).toEqual(["start:0", "end:0"]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should compress what the worker minified", async () => {
    new MinimizerPlugin({
      minify: [terserMinify, MinimizerPlugin.compress],
      minimizerOptions: [{}, { algorithm: "gzip" }],
    }).apply(compiler);

    const stats = await compile(compiler);
    const text = zlib
      .gunzipSync(readBytes(compiler, stats, "one.js"))
      .toString();

    // Minified first and compressed second, through the asset rather than in
    // one pass: what comes back out is terser's output, not the original.
    expect(text).not.toContain("\n\n");
    expect(text.length).toBeGreaterThan(0);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should start no pool for `compress` on its own", async () => {
    new MinimizerPlugin({
      minify: MinimizerPlugin.compress,
      minimizerOptions: { algorithm: "gzip" },
    }).apply(compiler);

    const stats = await compile(compiler);

    // It declares `supportsWorker` false — its bytes have no way across — so
    // nothing is spawned rather than a pool being built and left idle.
    expect(Worker).not.toHaveBeenCalled();
    expect(mockLifetime).toEqual([]);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should start no pool for a generator", async () => {
    new MinimizerPlugin({
      minify: terserMinify,
      generate: {
        implementation: MinimizerPlugin.compress,
        options: { algorithm: "gzip" },
        type: "asset",
        filename: "[path][base].gz",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // Generating runs in process, so the only pool is the minimizer's.
    expect(Worker).toHaveBeenCalledTimes(1);
    expect(mockLifetime).toEqual(["start:0", "end:0"]);
    expect(Object.keys(stats.compilation.assets)).toContain("one.js.gz");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should not run two pools at once when two minimizers ask for two stages", async () => {
    // Self-contained: a minify function reaches the pool as source and carries
    // nothing from this module's scope with it.
    const late = (input) => ({
      code: `/* late */${Object.values(input)[0]}`,
    });

    late.getStage = (compilation) =>
      compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER;

    new MinimizerPlugin({ minify: [terserMinify, late] }).apply(compiler);

    const stats = await compile(compiler);

    // Two passes, and each ends its pool before the next one starts: the
    // threads in flight never exceed what one pass asked for.
    expect(neverOverlapped()).toBe(true);
    expect(mockLifetime).toEqual(["start:0", "end:0", "start:1", "end:1"]);
    expect(getErrors(stats)).toEqual([]);
  });
});
