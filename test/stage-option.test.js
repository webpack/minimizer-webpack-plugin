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
/**
 * A generator that records when it ran and asks to run where compression does.
 * @param {string[]} order where to record
 * @param {string} label what to record
 * @returns {EXPECTED_ANY} the generator
 */
const lateGenerator = (order, label) => {
  /**
   * @param {Record<string, string | Buffer>} input input
   * @returns {{ code: string | Buffer }} the result
   */
  const run = (input) => {
    order.push(label);

    return { code: Object.values(input)[0] };
  };

  run.getStage = (compilation) =>
    compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER;

  return run;
};

/**
 * @param {string[]} order where to record
 * @param {string} label what to record
 * @param {number=} stage the stage it asks for, if any
 * @returns {EXPECTED_ANY} the minimizer
 */
const asking = (order, label, stage) => {
  /**
   * @param {Record<string, string | Buffer>} input input
   * @returns {{ code: string | Buffer }} the result
   */
  const run = (input) => {
    order.push(label);

    return { code: Object.values(input)[0] };
  };

  if (typeof stage === "number") {
    run.getStage = () => stage;
  }

  return run;
};

/**
 * The stages this plugin taps `processAssets` in, filled as the compilation
 * starts rather than when this is called. Reads whatever was applied before
 * it, so it is called after the plugin under test.
 * @param {import("webpack").Compiler} own compiler
 * @returns {number[]} the stages, in the order the hook runs them
 */
const tappedStages = (own) => {
  /** @type {number[]} */
  const stages = [];

  own.hooks.compilation.tap("ReadTaps", (compilation) => {
    for (const tap of compilation.hooks.processAssets.taps) {
      if (tap.name === "MinimizerPlugin") {
        stages.push(/** @type {number} */ (tap.stage));
      }
    }
  });

  return stages;
};

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

describe("where work runs", () => {
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

  it("should run an asset generator at its own stage, after the minimizers", async () => {
    const order = [];

    new MinimizerPlugin({
      parallel: false,
      minify: (input) => {
        order.push("minify");

        return { code: Object.values(input)[0] };
      },
      generate: {
        implementation: lateGenerator(order, "generate"),
        type: "asset",
        filename: "[path][base].copy",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["minify", "generate"]);
    expect(Object.keys(stats.compilation.assets)).toContain("one.js.copy");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should run two generators each where its own implementation asks", async () => {
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
          implementation: lateGenerator(order, "late"),
          type: "asset",
          filename: "[path][base].late",
        },
        early: {
          implementation: record("early"),
          type: "asset",
          filename: "[path][base].early",
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

  it("should tap once for every stage asked for, rather than once for all", async () => {
    const order = [];

    new MinimizerPlugin({
      parallel: false,
      minify: [
        asking(order, "minify"),
        asking(
          order,
          "transfer",
          Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        ),
        asking(order, "summarize", Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE),
      ],
      generate: {
        inline: {
          implementation: asking(
            order,
            "inline",
            Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
          ),
          type: "asset",
          filename: "[path][base].inline",
        },
        report: {
          implementation: asking(
            order,
            "report",
            Compilation.PROCESS_ASSETS_STAGE_REPORT,
          ),
          type: "asset",
          filename: "[path][base].report",
        },
      },
    }).apply(compiler);

    const stages = tappedStages(compiler);
    const stats = await compile(compiler);

    // Five of them written in neither this order nor one another's, so the
    // hook holds one tap per stage and runs them where each asked to be.
    expect(stages).toEqual([
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
      Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
      Compilation.PROCESS_ASSETS_STAGE_REPORT,
    ]);
    expect(order).toEqual([
      "minify",
      "inline",
      "summarize",
      "transfer",
      "report",
    ]);
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js",
      "one.js.inline",
      "one.js.report",
    ]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should tap once where nothing asks for a stage of its own", async () => {
    const order = [];

    new MinimizerPlugin({
      parallel: false,
      minify: [asking(order, "first"), asking(order, "second")],
    }).apply(compiler);

    const stages = tappedStages(compiler);
    const stats = await compile(compiler);

    expect(stages).toEqual([Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE]);
    expect(order).toEqual(["first", "second"]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should share one tap between everything asking for the same stage", async () => {
    const order = [];
    const transfer = Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER;

    new MinimizerPlugin({
      parallel: false,
      minify: [
        asking(order, "first", transfer),
        asking(order, "second", transfer),
      ],
      generate: {
        a: {
          implementation: asking(order, "a", transfer),
          type: "asset",
          filename: "[path][base].a",
        },
        b: {
          implementation: asking(order, "b", transfer),
          type: "asset",
          filename: "[path][base].b",
        },
      },
    }).apply(compiler);

    const stages = tappedStages(compiler);
    const stats = await compile(compiler);

    // Two taps for four: one for the minimizers and one for the generators,
    // which cannot share it — a generator reads what a minimizer wrote.
    expect(stages).toEqual([transfer, transfer]);
    expect(order).toEqual(["first", "second", "a", "b"]);
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js",
      "one.js.a",
      "one.js.b",
    ]);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });
});

describe("a minimizer that asks for its own stage", () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });
  });

  it("should run where `getStage` asks, with no option given", async () => {
    const order = [];

    new RecordStage(
      order,
      "size",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
    ).apply(compiler);
    new RecordStage(
      order,
      "hash",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
    ).apply(compiler);
    new MinimizerPlugin({
      parallel: false,
      minify: asking(
        order,
        "minify",
        Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
      ),
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["size", "hash", "minify"]);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should run each of an array where it asks, not all at the latest", async () => {
    const order = [];

    new RecordStage(
      order,
      "hash",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
    ).apply(compiler);
    new MinimizerPlugin({
      parallel: false,
      // They still chain — through the asset, which the later pass reads back
      // — but dragging the first to the last one's stage would carry it past
      // the hash, and the name would then describe bytes nobody is served.
      minify: [
        asking(order, "first"),
        asking(
          order,
          "second",
          Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        ),
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["first", "hash", "second"]);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should hash what minification produced, not what compression read", async () => {
    /**
     * @param {object=} options plugin options
     * @returns {Promise<string>} the emitted JavaScript asset's name
     */
    const nameOf = async (options) => {
      const own = getCompiler({
        entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
        output: {
          path: path.resolve(__dirname, "dist"),
          filename: "[name].[contenthash].js",
        },
      });

      if (options) {
        new MinimizerPlugin(options).apply(own);
      }

      const stats = await compile(own);

      return Object.keys(stats.compilation.assets).find((name) =>
        name.endsWith(".js"),
      );
    };

    const untouched = await nameOf();
    const terserOnly = await nameOf({
      test: /\.js$/i,
      parallel: false,
      minify: MinimizerPlugin.terserMinify,
    });
    const chained = await nameOf({
      test: /\.js$/i,
      parallel: false,
      minify: [
        { implementation: MinimizerPlugin.terserMinify },
        { implementation: MinimizerPlugin.compress },
      ],
    });

    // Minification lands before the hash is taken even with compression in the
    // array, so the name is terser's — not the one an untouched build gets.
    expect(chained).toBe(terserOnly);
    expect(chained).not.toBe(untouched);
  });

  it("should run a generator where its implementation asks", async () => {
    const order = [];

    new RecordStage(
      order,
      "hash",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
    ).apply(compiler);
    new MinimizerPlugin({
      parallel: false,
      minify: (input) => ({ code: Object.values(input)[0] }),
      generate: {
        implementation: asking(
          order,
          "generate",
          Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        ),
        type: "asset",
        filename: "[path][base].copy",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["hash", "generate"]);
    expect(Object.keys(stats.compilation.assets)).toContain("one.js.copy");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should take the latest stage a generator's own chain asks for", async () => {
    const order = [];

    new RecordStage(
      order,
      "hash",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
    ).apply(compiler);
    new MinimizerPlugin({
      parallel: false,
      minify: (input) => ({ code: Object.values(input)[0] }),
      generate: {
        // One generator written as a chain: it runs at one moment, so the
        // latest stage any link asks for is the one they can all run in.
        implementation: [asking(order, "plain"), lateGenerator(order, "late")],
        type: "asset",
        filename: "[path][base].copy",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(order).toEqual(["hash", "plain", "late"]);
    expect(Object.keys(stats.compilation.assets)).toContain("one.js.copy");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should put `compress` after the minimizers on its own", async () => {
    const order = [];

    new RecordStage(
      order,
      "hash",
      Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
    ).apply(compiler);
    new MinimizerPlugin({
      test: /\.js$/i,
      parallel: false,
      minify: (input) => {
        order.push("minify");

        return { code: Object.values(input)[0] };
      },
      generate: {
        implementation: MinimizerPlugin.compress,
        type: "asset",
        filename: "[path][base].gz",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // Minified, then hashed, then compressed — none of it stated in the config.
    expect(order).toEqual(["minify", "hash"]);
    expect(Object.keys(stats.compilation.assets)).toEqual([
      "one.js",
      "one.js.gz",
    ]);
    expect(getErrors(stats)).toEqual([]);
  });
});

describe('"compress" as a minimizer', () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });
  });

  it("should compress the asset in place when given to `minify`", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      // Where the server says what the encoding is, the asset keeps its name
      // and there is nothing beside it. No `stage`: `compress` asks for its own.
      minify: MinimizerPlugin.compress,
      minimizerOptions: { algorithm: "gzip" },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(Object.keys(stats.compilation.assets)).toEqual(["one.js"]);
    expect(
      zlib.gunzipSync(readBytes(compiler, stats, "one.js")).toString(),
    ).toContain("webpack");
    // What it wrote is another encoding of the bytes, not a smaller version
    // of them, so it says so rather than claiming the asset is minified.
    expect(stats.compilation.getAsset("one.js").info.compressed).toBe(true);
    expect(stats.compilation.getAsset("one.js").info.minimized).toBeUndefined();
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should take its options from its own entry in a `minify` array", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      minify: [
        {
          implementation: (input) => ({
            code: `/* minified */${Object.values(input)[0]}`,
          }),
        },
        {
          implementation: MinimizerPlugin.compress,
          options: { algorithm: "brotliCompress" },
        },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);
    const text = zlib
      .brotliDecompressSync(readBytes(compiler, stats, "one.js"))
      .toString();

    // Each minimizer in the array feeds the next, so the compressed bytes are
    // what the one before it produced.
    expect(Object.keys(stats.compilation.assets)).toEqual(["one.js"]);
    expect(text.startsWith("/* minified */")).toBe(true);
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should report an algorithm `zlib` does not have", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      minify: MinimizerPlugin.compress,
      minimizerOptions: { algorithm: "nope" },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(
      /algorithm "nope" is not found in "zlib"/,
    );
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
        // No `stage` here: `compress` asks for its own.
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

describe("what a function says it wrote", () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });
  });

  /**
   * A minimizer that rewrites nothing, so only the name it works under is
   * under test.
   * @param {string=} says the name it declares, if any
   * @param {number=} stage the stage it asks for, if any
   * @returns {EXPECTED_ANY} the minimizer
   */
  const saying = (says, stage) => {
    const run = (input) => ({ code: Object.values(input)[0] });

    if (says) {
      run.getAssetFlag = () => says;
    }

    if (typeof stage === "number") {
      run.getStage = () => stage;
    }

    return run;
  };

  it("should mark what a minimizer saying nothing wrote as minimized", async () => {
    new MinimizerPlugin({ test: /\.js$/i, minify: saying() }).apply(compiler);

    const stats = await compile(compiler);

    expect(stats.compilation.getAsset("one.js").info.minimized).toBe(true);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should write what a minimizer says instead of minimized", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      minify: saying("compressed"),
    }).apply(compiler);

    const stats = await compile(compiler);
    const { info } = stats.compilation.getAsset("one.js");

    expect(info.compressed).toBe(true);
    expect(info.minimized).toBeUndefined();
    expect(getErrors(stats)).toEqual([]);
  });

  it("should write what every minimizer of a chain says", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      minify: [saying(), saying("compressed")],
    }).apply(compiler);

    const stats = await compile(compiler);
    const { info } = stats.compilation.getAsset("one.js");

    // One of them minified it and the other re-encoded it, and the asset
    // carries both rather than whichever spoke last.
    expect(info.minimized).toBe(true);
    expect(info.compressed).toBe(true);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should take a name a minimizer builds rather than one written out", async () => {
    const run = (input) => ({ code: Object.values(input)[0] });
    const encoding = "br";

    run.getAssetFlag = () => `${encoding}Encoded`;

    new MinimizerPlugin({ test: /\.js$/i, minify: run }).apply(compiler);

    const stats = await compile(compiler);
    const { info } = stats.compilation.getAsset("one.js");

    // Nothing here knows the name in advance, so it is the function's answer
    // that reaches the asset rather than a spelling this plugin recognizes.
    expect(info.brEncoded).toBe(true);
    expect(info.minimized).toBeUndefined();
    expect(stats.toString()).toContain("[brEncoded]");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should leave alone an asset that already says what a minimizer writes", async () => {
    const ran = [];
    const run = (input) => {
      ran.push("ran");

      return { code: Object.values(input)[0] };
    };

    class AlreadyMinimized {
      apply(inner) {
        inner.hooks.compilation.tap("AlreadyMinimized", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "AlreadyMinimized",
              stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
            },
            (assets) => {
              for (const name of Object.keys(assets)) {
                compilation.updateAsset(name, (source) => source, {
                  minimized: true,
                });
              }
            },
          );
        });
      }
    }

    new AlreadyMinimized().apply(compiler);
    new MinimizerPlugin({ test: /\.js$/i, minify: run, parallel: false }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    // What a child compilation hands up is already minified, and saying so is
    // how it is declined.
    expect(ran).toEqual([]);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should not decline an asset over what an earlier pass of itself wrote", async () => {
    const ran = [];
    /**
     * @param {string} label what to record
     * @param {number=} stage the stage it asks for
     * @returns {EXPECTED_ANY} the minimizer
     */
    const recording = (label, stage) => {
      const run = (input) => {
        ran.push(label);

        return { code: Object.values(input)[0] };
      };

      if (typeof stage === "number") {
        run.getStage = () => stage;
      }

      return run;
    };

    new MinimizerPlugin({
      test: /\.js$/i,
      parallel: false,
      minify: [
        recording("first"),
        recording("second", Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER),
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    // Both say `minimized`, and the second runs a whole pass later: the flag
    // the first wrote is this plugin's own and does not decline it.
    expect(ran).toEqual(["first", "second"]);
    expect(stats.compilation.getAsset("one.js").info.minimized).toBe(true);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should mark a file `compress` generated as compressed", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      parallel: false,
      minify: (input) => ({ code: Object.values(input)[0] }),
      generate: {
        implementation: MinimizerPlugin.compress,
        options: { algorithm: "gzip" },
        type: "asset",
        filename: "[path][base].gz",
      },
    }).apply(compiler);

    const stats = await compile(compiler);
    const { info } = stats.compilation.getAsset("one.js.gz");

    // The name it works under replaces the generator's own rather than
    // joining it: the file is compressed, and saying so is what marks it.
    expect(info.compressed).toBe(true);
    expect(info.generated).toBeUndefined();
    expect(getErrors(stats)).toEqual([]);
  });

  it("should mark what a generator saying nothing wrote as generated", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      parallel: false,
      minify: (input) => ({ code: Object.values(input)[0] }),
      generate: {
        implementation: (input) => ({ code: Object.values(input)[0] }),
        type: "asset",
        filename: "[path][base].copy",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(stats.compilation.getAsset("one.js.copy").info.generated).toBe(true);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should not let one generator read what another one wrote", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      parallel: false,
      minify: (input) => ({ code: Object.values(input)[0] }),
      generate: {
        copy: {
          // Named so it matches `test` too, which is what puts it in front of
          // the generator below rather than leaving it out by its extension.
          implementation: (input) => ({ code: Object.values(input)[0] }),
          type: "asset",
          filename: "[path][base].copy.js",
        },
        gzip: {
          implementation: MinimizerPlugin.compress,
          options: { algorithm: "gzip" },
          type: "asset",
          filename: "[path][base].gz",
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);
    const printed = stats.toString({ relatedAssets: true });

    // The copy is marked with the name its generator works under, and
    // compressing declines anything already carrying one of those names, so
    // there is no `one.js.copy.js.gz`.
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js",
      "one.js.copy.js",
      "one.js.gz",
    ]);
    expect(printed).toContain("[generated]");
    expect(printed).toContain("[compressed]");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should print the flag a function wrote in stats", async () => {
    new MinimizerPlugin({
      test: /\.js$/i,
      minify: saying("compressed"),
    }).apply(compiler);

    const stats = await compile(compiler);
    const printed = stats.toString({ relatedAssets: true });

    expect(printed).toContain("[compressed]");
    expect(printed).not.toContain("[minimized]");
  });
});
