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
});

describe('"zlibCompress" generator', () => {
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
      // Hands the map back so `devtool` still has one to write out.
      minify: (input, sourceMap) => ({
        code: Object.values(input)[0],
        map: sourceMap,
      }),
      generate: {
        implementation: MinimizerPlugin.zlibCompress,
        type: "asset",
        filename: "[path][base].gz",
        stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        relatedName: "gzipped",
        assetInfo: { compressed: true },
        minRatio: 0.8,
        ...descriptor,
      },
    });

  it("should write a gzipped asset beside the one it read", async () => {
    compressionPlugin().apply(compiler);

    const stats = await compile(compiler);
    const { assets } = stats.compilation;

    expect(Object.keys(assets)).toEqual(["one.js", "one.js.gz"]);

    const original = stats.compilation.getAsset("one.js");
    const generated = stats.compilation.getAsset("one.js.gz");

    expect(generated.info.compressed).toBe(true);
    expect(original.info.related.gzipped).toBe("one.js.gz");
    expect(
      zlib.gunzipSync(readBytes(compiler, stats, "one.js.gz")).toString(),
    ).toBe(readBytes(compiler, stats, "one.js").toString());
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should leave an asset smaller than `threshold` alone", async () => {
    compressionPlugin({ threshold: 1024 * 1024 }).apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual(["one.js"]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should not keep a result above `minRatio`", async () => {
    compressionPlugin({ minRatio: 0.00001 }).apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual(["one.js"]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should delete the original when asked to", async () => {
    compressionPlugin({ deleteOriginalAssets: true }).apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual(["one.js.gz"]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should ask a `deleteOriginalAssets` function per asset", async () => {
    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/entry.js"),
        two: path.resolve(__dirname, "./fixtures/entry.js"),
      },
    });
    compressionPlugin({
      deleteOriginalAssets: (name) => name === "two.js",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js",
      "one.js.gz",
      "two.js.gz",
    ]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should leave the second generator nothing to delete", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      parallel: false,
      minify: (input) => ({ code: Object.values(input)[0] }),
      generate: {
        gzip: {
          implementation: MinimizerPlugin.zlibCompress,
          type: "asset",
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
          filename: "[path][base].gz",
          deleteOriginalAssets: true,
        },
        brotli: {
          implementation: MinimizerPlugin.zlibCompress,
          options: { algorithm: "brotliCompress" },
          type: "asset",
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
          filename: "[path][base].br",
          deleteOriginalAssets: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js.br",
      "one.js.gz",
    ]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should compress with brotli when asked to", async () => {
    compressionPlugin({
      filename: "[path][base].br",
      relatedName: "brotliCompressed",
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

  it("should run an algorithm of your own", async () => {
    compressionPlugin({
      filename: "[path][base].custom",
      relatedName: "customCompressed",
      minRatio: Infinity,
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

  it("should keep the source map when deleting the original", async () => {
    compiler = getCompiler({
      devtool: "source-map",
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });
    compressionPlugin({ deleteOriginalAssets: "keep-source-map" }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js.gz",
      "one.js.map",
    ]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should decline an asset already carrying this generator's result", async () => {
    class AlreadyCompressed {
      apply(inner) {
        inner.hooks.compilation.tap("AlreadyCompressed", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "AlreadyCompressed",
              stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
            },
            () => {
              const asset = compilation.getAsset("one.js");

              compilation.updateAsset(asset.name, asset.source, {
                related: { gzipped: "one.js.gz" },
              });
            },
          );
        });
      }
    }

    new AlreadyCompressed().apply(compiler);
    compressionPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual(["one.js"]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should take text and no options at all", async () => {
    // The generator path always hands it a `Buffer` and an options object, so
    // both fallbacks are reachable only by calling it directly.
    const text = "a".repeat(1000);
    const { code } = await MinimizerPlugin.zlibCompress({ "one.js": text });

    expect(zlib.gunzipSync(code).toString()).toBe(text);
  });

  describeIf(typeof zlib.zstdCompress === "function")("zstd", () => {
    it("should compress with an algorithm that has no defaults", async () => {
      compressionPlugin({
        filename: "[path][base].zst",
        relatedName: "zstdCompressed",
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

  it("should generate without minifying anything when `minify` is false", async () => {
    const seen = [];

    new MinimizerPlugin({
      minify: false,
      generate: {
        implementation: MinimizerPlugin.zlibCompress,
        type: "asset",
        filename: "[path][base].gz",
        stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
      },
    }).apply(compiler);
    compiler.hooks.compilation.tap("SeenInfo", (compilation) => {
      compilation.hooks.afterProcessAssets.tap("SeenInfo", () => {
        seen.push(compilation.getAsset("one.js").info);
      });
    });

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual([
      "one.js",
      "one.js.gz",
    ]);
    expect(seen[0].minimized).toBeUndefined();
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should let an `assetInfo` function answer for the whole info", async () => {
    compressionPlugin({
      assetInfo: (info, name, generatedName) => ({
        compressed: true,
        from: `${name} -> ${generatedName}`,
        // Nothing the original said is carried unless it is asked for.
        immutable: Boolean(info.immutable),
      }),
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(stats.compilation.getAsset("one.js.gz").info).toEqual({
      compressed: true,
      from: "one.js -> one.js.gz",
      immutable: false,
      generated: true,
      size: expect.any(Number),
    });
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should take a `filename` function", async () => {
    compressionPlugin({
      filename: (pathData) => `${pathData.filename}.gz`,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual([
      "one.js",
      "one.js.gz",
    ]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should write over the asset it read when named after it", async () => {
    compressionPlugin({
      filename: "[path][base]",
      // Nothing to delete and nothing to point at: the result took its place.
      deleteOriginalAssets: true,
      relatedName: "gzipped",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual(["one.js"]);
    expect(stats.compilation.getAsset("one.js").info.related).toBeUndefined();
    expect(
      zlib.gunzipSync(readBytes(compiler, stats, "one.js")).toString(),
    ).toContain("webpack");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should report an algorithm `zlib` does not have", async () => {
    compressionPlugin({ options: { algorithm: "nope" } }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(
      /algorithm "nope" is not found in "zlib"/,
    );
  });
});
