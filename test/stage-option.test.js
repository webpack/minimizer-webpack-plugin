import path from "path";
import zlib from "zlib";

import webpack from "webpack";

import MinimizerPlugin from "../src/index";

import { compile, getCompiler, getErrors, getWarnings } from "./helpers";

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

const { Compilation } = webpack;

/**
 * `describe` where this environment can run the block, `describe.skip` where it
 * cannot. `zlib.zstdCompress` arrived in Node 22.15, and is the one algorithm
 * here that carries no compression defaults of its own.
 * @param {boolean} condition whether it can
 * @returns {jest.Describe} describe, or describe.skip
 */
const describeIf = (condition) => (condition ? describe : describe.skip);

/**
 * Records the order in which `processAssets` taps run, so a stage a plugin was
 * asked to run in can be observed as a position rather than as a number.
 */
class RecordStage {
  constructor(order, label, stage) {
    this.order = order;
    this.label = label;
    this.stage = stage;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap("RecordStage", (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: "RecordStage", stage: this.stage },
        () => {
          this.order.push(this.label);
        },
      );
    });
  }
}

describe('"stage" option', () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });
  });

  it("should run the minimizers at PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE by default", async () => {
    const order = [];

    new RecordStage(
      order,
      "before",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_COMPATIBILITY,
    ).apply(compiler);
    new RecordStage(
      order,
      "after",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
    ).apply(compiler);
    new MinimizerPlugin({
      // The order is observable only where the minimizer runs in this process.
      parallel: false,
      minify: (input) => {
        order.push("minify");

        return { code: Object.values(input)[0] };
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["before", "minify", "after"]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should run the minimizers at the stage it names", async () => {
    const order = [];

    new RecordStage(
      order,
      "before",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
    ).apply(compiler);
    new MinimizerPlugin({
      parallel: false,
      stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
      minify: (input) => {
        order.push("minify");

        return { code: Object.values(input)[0] };
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["before", "minify"]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should run an asset generator at its own stage, after the minimizers", async () => {
    const order = [];

    new MinimizerPlugin({
      parallel: false,
      minify: (input) => {
        order.push("minify");

        return { code: Object.values(input)[0] };
      },
      generate: {
        implementation: (input) => {
          order.push("generate");

          return { code: Object.values(input)[0] };
        },
        type: "asset",
        filename: "[path][base].copy",
        stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["minify", "generate"]);
    expect(Object.keys(stats.compilation.assets)).toContain("one.js.copy");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should run two generators each at the stage it named", async () => {
    const order = [];

    /**
     * @param {string} label what to record when it runs
     * @returns {(input: Record<string, string | Buffer>) => { code: string | Buffer }} the generator
     */
    const record = (label) => (input) => {
      order.push(label);

      return { code: Object.values(input)[0] };
    };

    new MinimizerPlugin({
      parallel: false,
      minify: (input) => ({ code: Object.values(input)[0] }),
      generate: {
        late: {
          implementation: record("late"),
          type: "asset",
          filename: "[path][base].late",
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        },
        early: {
          implementation: record("early"),
          type: "asset",
          filename: "[path][base].early",
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["early", "late"]);
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js",
      "one.js.early",
      "one.js.late",
    ]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });
});

describe('"compress" generator', () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });
  });

  /**
   * @param {object} descriptor extra generator descriptor keys
   * @returns {MinimizerPlugin} the plugin
   */
  const compressionPlugin = (descriptor = {}) =>
    new MinimizerPlugin({
      test: /\.js$/i,
      parallel: false,
      minify: (input) => ({ code: Object.values(input)[0] }),
      generate: {
        implementation: MinimizerPlugin.compress,
        type: "asset",
        filename: "[path][base].gz",
        stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        ...descriptor,
      },
    });

  it("should write a gzipped asset beside the one it read", async () => {
    compressionPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual([
      "one.js",
      "one.js.gz",
    ]);
    expect(
      zlib.gunzipSync(readBytes(compiler, stats, "one.js.gz")).toString(),
    ).toBe(readBytes(compiler, stats, "one.js").toString());
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should compress with the algorithm it was given", async () => {
    compressionPlugin({
      filename: "[path][base].br",
      options: { algorithm: "brotliCompress" },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(
      zlib
        .brotliDecompressSync(readBytes(compiler, stats, "one.js.br"))
        .toString(),
    ).toBe(readBytes(compiler, stats, "one.js").toString());
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should run that algorithm with the options it was given", async () => {
    const sizeAt = async (level) => {
      const own = getCompiler({
        entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
      });

      new MinimizerPlugin({
        test: /\.js$/i,
        parallel: false,
        minify: (input) => ({ code: Object.values(input)[0] }),
        generate: {
          implementation: MinimizerPlugin.compress,
          options: { algorithm: "gzip", compressionOptions: { level } },
          type: "asset",
          filename: "[path][base].gz",
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        },
      }).apply(own);

      const stats = await compile(own);

      return readBytes(own, stats, "one.js.gz").length;
    };

    // Level 0 stores rather than compresses, so the option demonstrably reached
    // `zlib` rather than being replaced by the default.
    expect(await sizeAt(0)).toBeGreaterThan(await sizeAt(9));
  });

  it("should run an algorithm of your own", async () => {
    compressionPlugin({
      filename: "[path][base].custom",
      options: {
        algorithm: (input, options, callback) => {
          // A string rather than a `Buffer`, which is what a compressor
          // written against `zlib`'s callback is allowed to hand back.
          callback(undefined, `${options.prefix}${input.toString()}`);
        },
        compressionOptions: { prefix: "// compressed\n" },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readBytes(compiler, stats, "one.js.custom").toString()).toBe(
      `// compressed\n${readBytes(compiler, stats, "one.js").toString()}`,
    );
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should report what an algorithm of your own failed with", async () => {
    compressionPlugin({
      options: {
        algorithm: (input, options, callback) => {
          callback(new Error("nope"));
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/nope/);
  });

  it("should report an algorithm `zlib` does not have", async () => {
    compressionPlugin({ options: { algorithm: "nope" } }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(
      /algorithm "nope" is not found in "zlib"/,
    );
  });

  it("should take text and no options at all", async () => {
    // The generator path always hands it a `Buffer` and an options object, so
    // both fallbacks are reachable only by calling it directly.
    const text = "a".repeat(1000);
    const { code } = await MinimizerPlugin.compress({ "one.js": text });

    expect(zlib.gunzipSync(code).toString()).toBe(text);
  });

  describeIf(typeof zlib.zstdCompress === "function")("zstd", () => {
    it("should compress with an algorithm that has no defaults", async () => {
      compressionPlugin({
        filename: "[path][base].zst",
        options: { algorithm: "zstdCompress" },
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(
        zlib
          .zstdDecompressSync(readBytes(compiler, stats, "one.js.zst"))
          .toString(),
      ).toBe(readBytes(compiler, stats, "one.js").toString());
      expect(getErrors(stats)).toEqual([]);
      expect(getWarnings(stats)).toEqual([]);
    });
  });
});
