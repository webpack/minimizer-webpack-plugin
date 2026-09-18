import fs from "fs";
import os from "os";
import path from "path";

import MinimizerPlugin from "../src";
import { readPreset, replaceExtension } from "../src/utils";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readAsset,
} from "./helpers";
import { RUN_IMAGE_TESTS } from "./helpers/env";

/**
 * `describe` where this environment can run the block, `describe.skip` where it
 * cannot, so one file can carry blocks with different requirements.
 * @param {boolean} condition whether this environment can run it
 * @returns {jest.Describe} describe, or describe.skip
 */
const describeIf = (condition) => (condition ? describe : describe.skip);
// Renaming an asset needs `NormalModule`'s `processResult` hook to be able to
// await. Read off what the build did rather than off a version number: the
// release carrying it is not out yet, so a version test would claim the
// capability on every webpack released before it.
/**
 * @param {import("webpack").Stats} stats stats
 * @returns {boolean} true when the plugin reported that it cannot await
 */
function reportedNoAwait(stats) {
  return getErrors(stats).join("\n").includes("hook can await");
}

const IMAGE_RULES = [
  {
    test: /\.(png|jpe?g|svg)$/i,
    type: "asset/resource",
    generator: { filename: "[name][ext]" },
  },
];

/**
 * A stand-in for an encoder: it rewrites the bytes and says what the result is
 * now called, which is all the plugin needs to rename the asset.
 * @param {{ [file: string]: string | Buffer }} input input
 * @returns {{ code: Buffer, filename: string }} the re-encoded result
 */
function toWebp(input) {
  const [[name, code]] = Object.entries(input);

  toWebp.calls += 1;

  return {
    code: Buffer.concat([Buffer.from("WEBP:"), Buffer.from(code)]),
    filename: replaceExtension(name, "webp"),
  };
}

toWebp.supportsBinary = () => true;
toWebp.supportsWorker = () => false;
toWebp.calls = 0;

/**
 * A second encoder. Its source differs from `toWebp`'s deliberately: source is
 * what tells two generators apart when neither reports a version.
 * @param {{ [file: string]: string | Buffer }} input input
 * @returns {{ code: Buffer, filename: string }} the re-encoded result
 */
function toAvif(input) {
  const [[name, code]] = Object.entries(input);
  const marker = Buffer.from("AVIF:");

  toAvif.calls += 1;

  return {
    code: Buffer.concat([marker, Buffer.from(code)]),
    filename: replaceExtension(name, "avif"),
  };
}

toAvif.supportsBinary = () => true;
toAvif.supportsWorker = () => false;
toAvif.calls = 0;

/**
 * @param {import("webpack").Compiler} compiler compiler
 * @param {import("webpack").Stats} stats stats
 * @param {string} name emitted name
 * @returns {Buffer} the emitted bytes
 */
function readBytes(compiler, stats, name) {
  return compiler.outputFileSystem.readFileSync(
    path.join(stats.compilation.outputOptions.path, name),
  );
}

/**
 * @param {string} directory directory to remove, with everything under it
 * @returns {void}
 */
function removeRecursive(directory) {
  for (const entry of fs.readdirSync(directory)) {
    const full = path.join(directory, entry);

    if (fs.statSync(full).isDirectory()) {
      removeRecursive(full);
    } else {
      fs.unlinkSync(full);
    }
  }

  fs.rmdirSync(directory);
}

/**
 * @param {import("webpack").Stats} stats stats
 * @param {string} name the module's short name
 * @returns {{ cached: boolean, built: boolean }} how it came to be in the build
 */
function moduleState(stats, name) {
  const { modules } = stats.toJson({
    all: false,
    modules: true,
    cachedModules: true,
  });
  const found = modules.find((item) => item.name === name);

  return { cached: Boolean(found.cached), built: Boolean(found.built) };
}

/**
 * Drives a watching compiler one build at a time: each call resolves with the
 * stats of the next build the watcher completes.
 */
class Watcher {
  /**
   * @param {import("webpack").Compiler} compiler compiler
   */
  constructor(compiler) {
    this.pending = [];
    this.waiting = [];
    // Polling, because the CI runners disagree about native file watching.
    this.watching = compiler.watch(
      { aggregateTimeout: 50, poll: 100 },
      (error, stats) => {
        const settle = this.waiting.shift();

        if (settle) {
          settle(error, stats);
        } else {
          this.pending.push([error, stats]);
        }
      },
    );
  }

  /**
   * @returns {Promise<import("webpack").Stats>} the stats of the next build
   */
  next() {
    return new Promise((resolve, reject) => {
      /**
       * @param {(Error | null)=} error build error
       * @param {import("webpack").Stats=} stats build stats
       * @returns {void}
       */
      const settle = (error, stats) => {
        if (error) {
          reject(error);
        } else {
          resolve(/** @type {import("webpack").Stats} */ (stats));
        }
      };

      const ready = this.pending.shift();

      if (ready) {
        settle(ready[0], ready[1]);
      } else {
        this.waiting.push(settle);
      }
    });
  }

  /**
   * @returns {Promise<void>} resolves once the watcher has let go of the files
   */
  close() {
    return new Promise((resolve) => {
      this.watching.close(() => resolve());
    });
  }
}

describe("generate option", () => {
  it("should emit the renamed asset and point the bundle at it", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, generate: toWebp }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
    expect(names).toContain("image.webp");
    expect(names).not.toContain("image.jpg");
    expect(
      readBytes(compiler, stats, "image.webp").subarray(0, 5).toString(),
    ).toBe("WEBP:");

    // The reference baked into the bundle has to follow the rename, or the
    // asset is emitted under a name nothing asks for. Quoted, because the
    // module's own path stays in the emitted comment and should.
    const bundle = readBytes(compiler, stats, "main.js").toString();

    expect(bundle).toContain('"image.webp"');
    expect(bundle).not.toContain('"image.jpg"');
  });

  it("should keep the query and fragment the request carried", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/query-image.js"),
      module: {
        rules: [
          {
            test: /\.(png|jpe?g|svg|webp)/i,
            type: "asset/resource",
            generator: { filename: "[name][ext][query][fragment]" },
          },
        ],
      },
    });

    new MinimizerPlugin({ test: /\.jpe?g/i, generate: toWebp }).apply(compiler);

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.webp?w=100#frag");
    expect(names).not.toContain("image.jpg?w=100#frag");
  });

  it("should point a `new URL()` reference at the renamed asset", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/url-image.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g/i, generate: { webp: toWebp } }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.webp");
    expect(names).not.toContain("image.jpg");

    // A `new URL()` reads the same asset module an `import` does, so the rename
    // has to reach it too — it is the reference an image is usually behind.
    const bundle = readBytes(compiler, stats, "main.js").toString();

    expect(bundle).toContain('"image.webp"');
    expect(bundle).not.toContain('"image.jpg"');
  });

  it("should point a CSS `url()` at the renamed asset", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css-image.js"),
      experiments: { css: true },
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g/i, generate: { webp: toWebp } }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.webp");
    expect(names).not.toContain("image.jpg");

    const styles = readBytes(compiler, stats, "main.css").toString();

    expect(styles).toContain("image.webp");
    expect(styles).not.toContain("image.jpg");
  });

  it("should give an inlined asset the media type of what it became", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/url-image.js"),
      module: {
        rules: [{ test: /\.(png|jpe?g|svg)$/i, type: "asset/inline" }],
      },
    });

    new MinimizerPlugin({ test: /\.jpe?g/i, generate: { webp: toWebp } }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(getErrors(stats)).toEqual([]);

    // Nothing is emitted for an inlined asset, so the rename shows up as the
    // media type of the data URI rather than as a file name.
    const bundle = readBytes(compiler, stats, "main.js").toString();

    expect(bundle).toContain("data:image/webp;base64,");
    expect(bundle).not.toContain("data:image/jpeg");
  });

  it("should leave assets the filters reject alone", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.jpe?g$/i,
      exclude: /image\.jpe?g$/i,
      generate: toWebp,
    }).apply(compiler);

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.jpg");
    expect(names).not.toContain("image.webp");
  });
});

describe("generatorOptions", () => {
  /**
   * Records the options it was handed and rewrites nothing, so a test can read
   * back what reached it.
   * @param {{ [file: string]: string | Buffer }} input input
   * @param {undefined} sourceMap source map
   * @param {Record<string, EXPECTED_ANY>} generatorOptions the options under test
   * @returns {{ code: string | Buffer }} the input, unchanged
   */
  function records(input, sourceMap, generatorOptions) {
    const [[, code]] = Object.entries(input);

    records.seen.push(generatorOptions);

    return { code };
  }

  records.supportsBinary = () => true;
  records.supportsWorker = () => false;

  beforeEach(() => {
    records.seen = [];
  });

  /**
   * @param {object} options plugin options beyond `test` and `generate`
   * @param {EXPECTED_ANY} generate the generator, or an array of them
   * @returns {Promise<import("webpack").Stats>} the stats of the build
   */
  async function build(options, generate) {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, generate, ...options }).apply(
      compiler,
    );

    return compile(compiler);
  }

  it("should hand one object to the generator", async () => {
    const stats = await build(
      { generatorOptions: { encodeOptions: { webp: { quality: 90 } } } },
      records,
    );

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toHaveLength(1);
    expect(records.seen[0]).toMatchObject({
      encodeOptions: { webp: { quality: 90 } },
    });
  });

  it("should default to an empty object", async () => {
    const stats = await build({}, records);

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toHaveLength(1);
    // `module` and `ecma` are overlaid onto a generator's options the same way
    // they are onto a minimizer's, so an absent `generatorOptions` is not bare.
    expect(Object.keys(records.seen[0]).sort()).toEqual(["ecma", "module"]);
  });

  it("should match an array of options to an array of generators", async () => {
    const stats = await build(
      { generatorOptions: [{ first: true }, { second: true }] },
      [records, records],
    );

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toHaveLength(2);
    expect(records.seen[0]).toMatchObject({ first: true });
    expect(records.seen[1]).toMatchObject({ second: true });
    expect(records.seen[0]).not.toHaveProperty("second");
  });

  it("should share one object across an array of generators", async () => {
    const stats = await build({ generatorOptions: { shared: true } }, [
      records,
      records,
    ]);

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toHaveLength(2);
    expect(records.seen[0]).toMatchObject({ shared: true });
    expect(records.seen[1]).toMatchObject({ shared: true });
  });
});

describe("sharpGenerate target format", () => {
  it("should report when no target format was asked for", async () => {
    const result = await MinimizerPlugin.sharpGenerate(
      { "image.jpg": Buffer.from("x") },
      undefined,
      {},
    );

    expect(result.errors).toHaveLength(1);
    expect(String(result.errors[0])).toMatch(/no target format/);
  });

  it("should report when `encodeOptions` names more than one format", async () => {
    const result = await MinimizerPlugin.sharpGenerate(
      { "image.jpg": Buffer.from("x") },
      undefined,
      { encodeOptions: { webp: {}, avif: {} } },
    );

    expect(result.errors).toHaveLength(1);
    expect(String(result.errors[0])).toMatch(/ambiguous/);
  });

  it("should report a format sharp cannot write", async () => {
    const result = await MinimizerPlugin.sharpGenerate(
      { "image.jpg": Buffer.from("x") },
      undefined,
      { encodeOptions: { bmp: {} } },
    );

    expect(result.errors).toHaveLength(1);
    expect(String(result.errors[0])).toMatch(/does not write 'bmp'/);
  });
});

describe("imageminGenerate", () => {
  // The only block here needing the image packages, so it is gated on its own
  // rather than the whole file being skipped where they are absent.
  describeIf(RUN_IMAGE_TESTS)("with `imagemin` installed", () => {
    // SVG markup under a name claiming a raster format: the same mismatch
    // `imageminMinify` refuses, which is the one a generator exists to take.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="1.00000"/></svg>',
    );

    it("should rename an image a plugin turned into SVG", async () => {
      const { code, filename, warnings } =
        await MinimizerPlugin.imageminGenerate(
          { "photo.png": svg },
          undefined,
          { plugins: ["svgo"] },
        );

      expect(warnings).toBeUndefined();
      expect(filename).toBe("photo.svg");
      // svgo ran: the padded coordinate is what it trims.
      expect(code.toString()).not.toContain("1.00000");
      expect(code.toString()).toContain("<svg");
    });

    it("should keep the name when the format did not change", async () => {
      const { code, filename } = await MinimizerPlugin.imageminGenerate(
        { "photo.svg": svg },
        undefined,
        { plugins: ["svgo"] },
      );

      expect(filename).toBeUndefined();
      expect(code.toString()).not.toContain("1.00000");
    });

    it("should keep the query and fragment the name carried", async () => {
      const { filename } = await MinimizerPlugin.imageminGenerate(
        { "photo.png?w=100#frag": svg },
        undefined,
        { plugins: ["svgo"] },
      );

      expect(filename).toBe("photo.svg?w=100#frag");
    });

    it("should declare what it needs from the plugin", () => {
      expect(MinimizerPlugin.imageminGenerate.supportsBinary()).toBe(true);
      // Its plugins shell out to native binaries, so it cannot leave the process.
      expect(MinimizerPlugin.imageminGenerate.supportsWorker()).toBe(false);
      expect(MinimizerPlugin.imageminGenerate.supportsWorkerThreads()).toBe(
        false,
      );
      expect(MinimizerPlugin.imageminGenerate.filter("photo.png")).toBe(true);
      expect(MinimizerPlugin.imageminGenerate.filter("main.js")).toBe(false);
    });
  });
});

describe("generate presets", () => {
  /**
   * @param {string} tag what it writes in front of the bytes
   * @param {string} extension what the result is called
   * @returns {EXPECTED_ANY} a generator that renames to `extension`
   */
  function encoderNamed(tag, extension) {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer, filename: string }} the re-encoded result
     */
    function encode(input) {
      const [[name, code]] = Object.entries(input);

      encode.calls += 1;

      return {
        code: Buffer.concat([Buffer.from(`${tag}:`), Buffer.from(code)]),
        filename: replaceExtension(name, extension),
      };
    }

    encode.supportsBinary = () => true;
    encode.supportsWorker = () => false;
    encode.calls = 0;

    return encode;
  }

  /**
   * @param {string} entry fixture that imports the image
   * @param {object} options plugin options
   * @returns {Promise<{ stats: import("webpack").Stats, assets: string[] }>} what the build produced
   */
  async function build(entry, options) {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, entry),
      module: {
        rules: [
          {
            test: /\.(png|jpe?g|svg|webp|avif)/i,
            type: "asset/resource",
            generator: { filename: "[name][ext][query][fragment]" },
          },
        ],
      },
    });

    new MinimizerPlugin({ test: /\.jpe?g/i, ...options }).apply(compiler);

    const stats = await compile(compiler);

    return { stats, assets: Object.keys(stats.compilation.assets) };
  }

  it("should run the preset the asset asks for by name", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const avif = encoderNamed("AVIF", "avif");
    const { stats, assets } = await build("./fixtures/query-image.js", {
      generate: { webp, avif },
    });

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(getErrors(stats)).toEqual([]);
    // `query-image.js` imports `./image.jpg?w=100#frag`, which names no preset.
    expect(webp.calls).toBe(0);
    expect(avif.calls).toBe(0);
    expect(assets).toContain("image.jpg?w=100#frag");
  });

  it("should pick between presets and leave the others alone", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const avif = encoderNamed("AVIF", "avif");
    const { stats, assets } = await build("./fixtures/preset-image.js", {
      generate: { webp, avif },
    });

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(getErrors(stats)).toEqual([]);
    expect(webp.calls).toBe(1);
    expect(avif.calls).toBe(0);
    expect(assets).toContain("image.webp?as=webp");
    expect(assets).not.toContain("image.jpg?as=webp");
  });

  it("should hand each preset its own options", async () => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @param {undefined} sourceMap source map
     * @param {{ tag?: string }} generatorOptions the preset's options
     * @returns {{ code: Buffer, filename: string }} the re-encoded result
     */
    function records(input, sourceMap, generatorOptions) {
      const [[name, code]] = Object.entries(input);

      records.seen.push(generatorOptions.tag);

      return {
        code: Buffer.from(code),
        filename: replaceExtension(name, "webp"),
      };
    }

    records.supportsBinary = () => true;
    records.supportsWorker = () => false;
    records.seen = [];

    const { stats } = await build("./fixtures/preset-image.js", {
      generate: { webp: records, avif: records },
      generatorOptions: {
        webp: { tag: "for-webp" },
        avif: { tag: "for-avif" },
      },
    });

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toEqual(["for-webp"]);
  });

  it("should report a preset nothing defines", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build("./fixtures/unknown-preset.js", {
      generate: { webp },
    });

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(getErrors(stats).join("\n")).toContain(
      "no 'jxl' preset in `generate`, which defines 'webp'",
    );
    // Reported rather than guessed at: the asset is left as it was.
    expect(assets).toContain("image.jpg?as=jxl");
    expect(webp.calls).toBe(0);
  });
});

describe("preset resolution", () => {
  // `generate` in module mode needs a webpack that can await `processResult`,
  // so these branches are unreachable from a build on any released one.
  it("should read the preset an asset's own name asks for", () => {
    expect(readPreset("image.jpg?as=webp")).toBe("webp");
    expect(readPreset("image.jpg?as=webp#fragment")).toBe("webp");
    expect(readPreset("image.jpg?width=100&as=avif")).toBe("avif");
    expect(readPreset("image.jpg")).toBeUndefined();
    expect(readPreset("image.jpg?width=100")).toBeUndefined();
    expect(readPreset("image.jpg?as=")).toBeUndefined();
    expect(readPreset("image.jpg#as=webp")).toBeUndefined();
  });

  /**
   * @returns {EXPECTED_ANY} something `generatorFor` can push errors onto
   */
  const stubCompilation = () => ({ errors: [] });

  it("should return the only generator when none are named", () => {
    const plugin = new MinimizerPlugin({ generate: toWebp });
    const compilation = stubCompilation();

    expect(plugin.generatorFor(compilation, "image.jpg").implementation).toBe(
      toWebp,
    );
    expect(compilation.errors).toEqual([]);
  });

  it("should return the named generator an asset asks for", () => {
    const plugin = new MinimizerPlugin({ generate: { webp: toWebp } });
    const compilation = stubCompilation();

    expect(
      plugin.generatorFor(compilation, "image.jpg?as=webp").implementation,
    ).toBe(toWebp);
    expect(compilation.errors).toEqual([]);
  });

  it("should leave an asset naming no generator alone", () => {
    const plugin = new MinimizerPlugin({ generate: { webp: toWebp } });
    const compilation = stubCompilation();

    expect(plugin.generatorFor(compilation, "image.jpg")).toBeUndefined();
    expect(compilation.errors).toEqual([]);
  });

  it("should report an asset naming a generator nothing defines", () => {
    const plugin = new MinimizerPlugin({ generate: { webp: toWebp } });
    const compilation = stubCompilation();

    expect(
      plugin.generatorFor(compilation, "image.jpg?as=jxl"),
    ).toBeUndefined();
    expect(compilation.errors).toHaveLength(1);
    expect(compilation.errors[0].message).toMatch(
      /no 'jxl' preset in `generate`, which defines 'webp'/,
    );
  });

  it("should not reach an `asset` generator through `?as=`", () => {
    const plugin = new MinimizerPlugin({
      generate: { webp: { implementation: toWebp, type: "asset" } },
    });
    const compilation = stubCompilation();

    expect(
      plugin.generatorFor(compilation, "image.jpg?as=webp"),
    ).toBeUndefined();
    expect(compilation.errors).toEqual([]);
  });

  it("should hand a named generator its own options", () => {
    const plugin = new MinimizerPlugin({
      generate: { webp: { implementation: toWebp, options: { tag: "own" } } },
    });

    expect(
      plugin.generatorFor(stubCompilation(), "image.jpg?as=webp").options,
    ).toEqual({ tag: "own" });
  });
});

describe("generate assets", () => {
  /**
   * An encoder that reports how often it ran, so a test can tell "declined" from
   * "ran and produced the same name".
   * @param {string} tag bytes it prefixes its output with
   * @param {string} extension extension it re-encodes to
   * @returns {EXPECTED_ANY} the encoder
   */
  function encoderNamed(tag, extension) {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer, filename: string }} the re-encoded result
     */
    function encode(input) {
      const [[name, code]] = Object.entries(input);

      encode.calls += 1;

      return {
        ...encode.reports,
        code: Buffer.concat([Buffer.from(`${tag}:`), Buffer.from(code)]),
        filename: replaceExtension(name, extension),
      };
    }

    encode.supportsBinary = () => true;
    encode.supportsWorker = () => false;
    encode.calls = 0;
    encode.reports = {};

    return encode;
  }

  /**
   * @param {object} options plugin options
   * @returns {Promise<{ stats: import("webpack").Stats, assets: string[] }>} what the build produced
   */
  async function build(options) {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, ...options }).apply(compiler);

    const stats = await compile(compiler);

    return { compiler, stats, assets: Object.keys(stats.compilation.assets) };
  }

  it("should generate a new asset beside the one it read", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { compiler, stats, assets } = await build({
      generate: { webp: { implementation: webp, type: "asset" } },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
    expect(webp.calls).toBe(1);
    expect(assets).toContain("image.webp");
    expect(assets).toContain("image.jpg");
    expect(readAsset("image.webp", compiler, stats).toString()).toMatch(
      /^WEBP:/,
    );
  });

  it("should name the generated asset with `filename` when given one", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          filename: "generated/[name].webp",
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(assets).toContain("generated/image.webp");
    expect(assets).not.toContain("image.webp");
  });

  it("should fill `[width]` and `[height]` from what the generator reports", async () => {
    const webp = encoderNamed("WEBP", "webp");

    webp.reports = { width: 320, height: 200 };

    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          filename: "[name]-[width]x[height].webp",
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(assets).toContain("image-320x200.webp");
  });

  it("should error when `filename` asks for a size the generator does not report", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          filename: "[name]-[width].webp",
        },
      },
    });

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(
      /asks for a size this generator does not report/,
    );
    expect(assets).not.toContain("image-[width].webp");
  });

  it("should remove the original with `deleteOriginalAssets`", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          deleteOriginalAssets: true,
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(assets).toContain("image.webp");
    expect(assets).not.toContain("image.jpg");
  });

  it("should report an asset generator that throws", async () => {
    /**
     * @returns {never} never returns
     */
    function boom() {
      throw new Error("the encoder gave up");
    }

    boom.supportsBinary = () => true;
    boom.supportsWorker = () => false;

    const { stats, assets } = await build({
      generate: { webp: { implementation: boom, type: "asset" } },
    });

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/the encoder gave up/);
    expect(assets).not.toContain("image.webp");
  });

  it("should surface what an asset generator reports", async () => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {EXPECTED_ANY} the result, with diagnostics
     */
    function noisy(input) {
      const [[name, code]] = Object.entries(input);

      return {
        code: Buffer.from(code),
        filename: replaceExtension(name, "webp"),
        errors: ["could not read the colour profile"],
        warnings: ["fell back to the default quality"],
      };
    }

    noisy.supportsBinary = () => true;
    noisy.supportsWorker = () => false;

    const { stats, assets } = await build({
      generate: { webp: { implementation: noisy, type: "asset" } },
    });

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/could not read the colour profile/);
    expect(getWarnings(stats)).toHaveLength(1);
    expect(getWarnings(stats)[0]).toMatch(/fell back to the default quality/);
    // Both reached the build, and the error still decides: a warning alongside
    // one does not make the result it gave up on worth writing.
    expect(assets).not.toContain("image.webp");
  });

  it("should update an asset the generated name already names", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { compiler, stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          // Resolves to the name the asset already has.
          filename: "[name][ext]",
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(assets.filter((name) => name === "image.jpg")).toHaveLength(1);
    expect(assets).not.toContain("image.webp");
    expect(readAsset("image.jpg", compiler, stats).toString()).toMatch(
      /^WEBP:/,
    );
  });

  it("should skip an asset its `filter` declines", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          filter: (name) => !name.endsWith(".jpg"),
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(webp.calls).toBe(0);
    expect(assets).not.toContain("image.webp");
    expect(assets).toContain("image.jpg");
  });

  it("should generate every asset generator asked for, from one asset", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const avif = encoderNamed("AVIF", "avif");
    const { stats, assets } = await build({
      generate: {
        webp: { implementation: webp, type: "asset" },
        avif: { implementation: avif, type: "asset" },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(webp.calls).toBe(1);
    expect(avif.calls).toBe(1);
    expect(assets).toContain("image.webp");
    expect(assets).toContain("image.avif");
    expect(assets).toContain("image.jpg");
  });

  it("should not let `?as=` reach an asset generator", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/preset-image.js"),
      module: {
        rules: [
          {
            test: /\.(png|jpe?g|svg|webp|avif)/i,
            type: "asset/resource",
            generator: { filename: "[name][ext][query][fragment]" },
          },
        ],
      },
    });

    new MinimizerPlugin({
      test: /\.jpe?g/i,
      generate: { webp: { implementation: webp, type: "asset" } },
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    // The import named the preset, but an `asset` generator reads what was
    // emitted, so the module keeps its own name and the new file sits beside it.
    expect(assets).toContain("image.jpg?as=webp");
    expect(assets).toContain("image.webp?as=webp");
  });

  it("should keep the original bytes when the generator returns no code", async () => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ filename: string }} a name, and nothing else
     */
    const rename = (input) => {
      const [[name]] = Object.entries(input);

      return { filename: replaceExtension(name, "webp") };
    };

    rename.supportsBinary = () => true;
    rename.supportsWorker = () => false;

    const { compiler, stats, assets } = await build({
      generate: { webp: { implementation: rename, type: "asset" } },
    });

    // Saying nothing about the bytes is not saying the file is empty: what it
    // read is what gets written under the name it asked for.
    expect(getErrors(stats)).toEqual([]);
    expect(assets).toContain("image.webp");
    expect(
      compiler.outputFileSystem
        .readFileSync(
          path.join(stats.compilation.outputOptions.path, "image.webp"),
        )
        .equals(
          fs.readFileSync(path.resolve(__dirname, "./fixtures/image.jpg")),
        ),
    ).toBe(true);
  });

  it("should take a generator's text result as bytes", async () => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: string, filename: string }} text, not a buffer
     */
    const asText = (input) => {
      const [[name]] = Object.entries(input);

      return { code: "WEBP:as text", filename: replaceExtension(name, "webp") };
    };

    asText.supportsBinary = () => true;
    asText.supportsWorker = () => false;

    const { compiler, stats, assets } = await build({
      generate: { webp: { implementation: asText, type: "asset" } },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(assets).toContain("image.webp");
    expect(readAsset("image.webp", compiler, stats)).toBe("WEBP:as text");
  });

  it("should write no file when the generator reported an error", async () => {
    const webp = encoderNamed("WEBP", "webp");

    webp.reports = { errors: ["cannot encode this"] };

    const { stats, assets } = await build({
      generate: { webp: { implementation: webp, type: "asset" } },
    });

    // The bytes it handed back are whatever it had when it gave up, so the
    // file would be wrong: the error is the whole result.
    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/cannot encode this/);
    expect(assets).not.toContain("image.webp");
    expect(assets).toContain("image.jpg");
  });

  it("should still write a file when the generator only warned", async () => {
    const webp = encoderNamed("WEBP", "webp");

    webp.reports = { warnings: ["lossy at this quality"] };

    const { stats, assets } = await build({
      generate: { webp: { implementation: webp, type: "asset" } },
    });

    // A warning is something to say about a result, not a refusal to give one.
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toHaveLength(1);
    expect(getWarnings(stats)[0]).toMatch(/lossy at this quality/);
    expect(assets).toContain("image.webp");
  });
});

describe("generate options", () => {
  /**
   * @param {string} tag bytes it prefixes its output with
   * @returns {EXPECTED_ANY} an encoder that records the options it was handed
   */
  function encoderNamed(tag) {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @param {undefined} sourceMap source map
     * @param {{ tag?: string }} generatorOptions the options it was handed
     * @returns {{ code: Buffer, filename: string }} the re-encoded result
     */
    function encode(input, sourceMap, generatorOptions) {
      const [[name, code]] = Object.entries(input);

      encode.saw = generatorOptions;

      return {
        code: Buffer.concat([Buffer.from(`${tag}:`), Buffer.from(code)]),
        filename: replaceExtension(name, "webp"),
      };
    }

    encode.supportsBinary = () => true;
    encode.supportsWorker = () => false;
    encode.saw = undefined;

    return encode;
  }

  /**
   * @param {object} options plugin options
   * @returns {Promise<import("webpack").Stats>} what the build produced
   */
  async function build(options) {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, ...options }).apply(compiler);

    return compile(compiler);
  }

  it("should take a generator's options from `generate` itself", async () => {
    const webp = encoderNamed("WEBP");
    const stats = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          options: { tag: "from-generate" },
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(webp.saw.tag).toBe("from-generate");
  });

  it("should still take them from the deprecated `generatorOptions`", async () => {
    const webp = encoderNamed("WEBP");
    const stats = await build({
      generate: { webp: { implementation: webp, type: "asset" } },
      generatorOptions: { webp: { tag: "from-generator-options" } },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(webp.saw.tag).toBe("from-generator-options");
  });

  it("should take them from an unnamed generator's own `options`", async () => {
    const webp = encoderNamed("WEBP");
    const stats = await build({
      generate: {
        implementation: webp,
        type: "asset",
        options: { tag: "unnamed" },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(webp.saw.tag).toBe("unnamed");
  });

  /**
   * Validation runs while webpack applies its plugins, so the plugin has to be
   * in the config rather than applied to a compiler that already exists.
   * @param {object} options plugin options
   * @returns {import("webpack").Compiler} compiler
   */
  function construct(options) {
    return getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
      plugins: [new MinimizerPlugin({ test: /\.jpe?g$/i, ...options })],
    });
  }

  it("should reject an asset-only field on an `import` generator", () => {
    const webp = encoderNamed("WEBP", "webp");

    expect(() =>
      construct({
        generate: { webp: { implementation: webp, filename: "[name].webp" } },
      }),
    ).toThrow(/`filename` in `generate`'s 'webp' belongs to a generator with/);

    expect(() =>
      construct({
        generate: {
          webp: {
            implementation: webp,
            filter: () => true,
            deleteOriginalAssets: true,
          },
        },
      }),
    ).toThrow(/`filter` and `deleteOriginalAssets` in `generate`'s 'webp'/);
  });

  it("should reject the compression fields on an `import` generator", () => {
    const webp = encoderNamed("WEBP");

    // They describe a second file being worth writing, and an `import`
    // generator writes none — it re-encodes the module it was asked for.
    expect(() =>
      construct({
        generate: {
          webp: {
            implementation: webp,
            threshold: 1024,
            minRatio: 0.8,
            relatedName: "gzipped",
          },
        },
      }),
    ).toThrow(
      /`threshold` and `minRatio` and `relatedName` in `generate`'s 'webp'/,
    );
  });

  it("should reject options given in both places for one generator", () => {
    const webp = encoderNamed("WEBP");

    expect(() =>
      construct({
        generate: { webp: { implementation: webp, options: { tag: "a" } } },
        generatorOptions: { webp: { tag: "b" } },
      }),
    ).toThrow(/'webp' generator in `generate` sets its own `options`/);
  });

  it("should reject a `generatorOptions` key naming no generator", () => {
    const webp = encoderNamed("WEBP");

    expect(() =>
      construct({
        generate: { webp: { implementation: webp, type: "asset" } },
        generatorOptions: { webp2: { tag: "typo" } },
      }),
    ).toThrow(/`generatorOptions.webp2` names no generator/);
  });
});

describe("generate option in watch mode", () => {
  let context;
  let watcher;

  beforeEach(() => {
    toWebp.calls = 0;
    // Through `realpathSync`: `os.tmpdir()` is a symlink on macOS, and webpack
    // resolves a module through the real path, so a module under a symlinked
    // context is not named relative to it.
    context = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "minimizer-watch-")),
    );

    fs.writeFileSync(
      path.join(context, "index.js"),
      'import jpg from "./image.jpg";\n\n// eslint-disable-next-line no-console\nconsole.log(jpg);\n',
    );
    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("first"));
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.close();
      watcher = undefined;
    }

    removeRecursive(context);
  });

  /**
   * @returns {import("webpack").Compiler} a compiler over the temporary project
   */
  function makeCompiler() {
    const compiler = getCompiler({
      context,
      entry: path.join(context, "index.js"),
      // `production` leaves caching off, and then every watch build rebuilds
      // every module — which is not what a rename has to survive.
      cache: { type: "memory" },
      module: {
        rules: [
          {
            test: /\.jpe?g$/i,
            type: "asset/resource",
            generator: { filename: "[name][ext]" },
          },
        ],
      },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, generate: toWebp }).apply(
      compiler,
    );

    return compiler;
  }

  /**
   * @param {import("webpack").Compiler} compiler compiler
   * @param {import("webpack").Stats} stats stats
   * @param {string} name emitted name
   * @returns {Buffer} the emitted bytes
   */
  function readBytes(compiler, stats, name) {
    return compiler.outputFileSystem.readFileSync(
      path.join(stats.compilation.outputOptions.path, name),
    );
  }

  it("should re-emit the renamed asset when the image changes", async () => {
    const compiler = makeCompiler();

    watcher = new Watcher(compiler);

    const first = await watcher.next();

    if (reportedNoAwait(first)) {
      return;
    }

    expect(getErrors(first)).toEqual([]);
    expect(Object.keys(first.compilation.assets)).toContain("image.webp");
    expect(readBytes(compiler, first, "image.webp").toString()).toBe(
      "WEBP:first",
    );

    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("second"));

    const second = await watcher.next();

    expect(getErrors(second)).toEqual([]);

    const names = Object.keys(second.compilation.assets);

    expect(names).toContain("image.webp");
    expect(names).not.toContain("image.jpg");
    // The generator's answer is cached on the bytes, so new bytes have to
    // reach it rather than the first build's result being served again.
    expect(toWebp.calls).toBe(2);
    expect(readBytes(compiler, second, "image.webp").toString()).toBe(
      "WEBP:second",
    );
  });

  it("should keep the rename when only the module importing it changes", async () => {
    const compiler = makeCompiler();

    watcher = new Watcher(compiler);

    const first = await watcher.next();

    if (reportedNoAwait(first)) {
      return;
    }

    expect(Object.keys(first.compilation.assets)).toContain("image.webp");

    fs.writeFileSync(
      path.join(context, "index.js"),
      'import jpg from "./image.jpg";\n\n// eslint-disable-next-line no-console\nconsole.log(jpg, "changed");\n',
    );

    const second = await watcher.next();

    expect(getErrors(second)).toEqual([]);

    const names = Object.keys(second.compilation.assets);

    // One call across both builds is the evidence that the image module was
    // not rebuilt, so the rename survived on the module rather than being
    // reapplied — `buildInfo.assetResource` is what carries it.
    expect(toWebp.calls).toBe(1);
    expect(names).toContain("image.webp");
    expect(names).not.toContain("image.jpg");

    const bundle = readBytes(compiler, second, "main.js").toString();

    expect(bundle).toContain('"image.webp"');
    expect(bundle).not.toContain('"image.jpg"');
  });
});

describe("asset generator in watch mode", () => {
  let context;
  let watcher;

  beforeEach(() => {
    toWebp.calls = 0;
    context = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "minimizer-asset-watch-")),
    );

    fs.writeFileSync(
      path.join(context, "index.js"),
      'import jpg from "./image.jpg";\n\n// eslint-disable-next-line no-console\nconsole.log(jpg);\n',
    );
    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("first"));
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.close();
      watcher = undefined;
    }
  });

  it("should not write the generated file again when nothing it reads changed", async () => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer, filename: string }} the re-encoded result
     */
    const webp = (input) => {
      const [[name, code]] = Object.entries(input);

      webp.calls += 1;

      return {
        code: Buffer.concat([Buffer.from("WEBP:"), Buffer.from(code)]),
        filename: replaceExtension(name, "webp"),
      };
    };

    webp.supportsBinary = () => true;
    webp.supportsWorker = () => false;
    webp.calls = 0;
    const compiler = getCompiler({
      context,
      entry: path.join(context, "index.js"),
      cache: { type: "memory" },
      module: {
        rules: [
          {
            test: /\.jpe?g$/i,
            type: "asset/resource",
            generator: { filename: "[name][ext]" },
          },
        ],
      },
    });

    new MinimizerPlugin({
      test: /\.jpe?g$/i,
      generate: { implementation: webp, type: "asset" },
    }).apply(compiler);

    watcher = new Watcher(compiler);

    const first = await watcher.next();

    expect(getErrors(first)).toEqual([]);
    expect([...first.compilation.emittedAssets]).toContain("image.webp");

    fs.writeFileSync(
      path.join(context, "index.js"),
      'import jpg from "./image.jpg";\n\n// eslint-disable-next-line no-console\nconsole.log(jpg, "changed");\n',
    );

    const second = await watcher.next();

    expect(getErrors(second)).toEqual([]);
    // The image did not change, so the cache answers and the generator does
    // not run again. What it answers with has to be the source it stored, or
    // webpack sees a new one and writes an identical file over the old.
    expect(webp.calls).toBe(1);
    expect(Object.keys(second.compilation.assets)).toContain("image.webp");
    expect([...second.compilation.emittedAssets]).not.toContain("image.webp");
  });
});

describe("generate option with the filesystem cache", () => {
  let context;
  let cacheDirectory;

  beforeEach(() => {
    toWebp.calls = 0;
    toAvif.calls = 0;
    context = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "minimizer-fs-cache-")),
    );
    cacheDirectory = path.join(context, "cache");

    fs.writeFileSync(
      path.join(context, "index.js"),
      'import jpg from "./image.jpg";\n\n// eslint-disable-next-line no-console\nconsole.log(jpg);\n',
    );
    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("first"));
  });

  afterEach(() => {
    removeRecursive(context);
  });

  /**
   * Runs one build against the shared cache directory and closes the compiler,
   * which is what writes the pack out for the next run to read.
   * @param {object=} options plugin options overriding the defaults
   * @returns {Promise<{ stats: import("webpack").Stats, assets: string[], read: (name: string) => string }>} what the build produced
   */
  function run(options) {
    const compiler = getCompiler({
      context,
      entry: path.join(context, "index.js"),
      // Through the config rather than a later `apply`: the cache strategy is
      // built while webpack applies the configured plugins, so a plugin
      // applied after `webpack()` returns cannot reach its version.
      plugins: [
        new MinimizerPlugin({
          test: /\.jpe?g$/i,
          generate: toWebp,
          ...options,
        }),
      ],
      cache: {
        type: "filesystem",
        cacheDirectory,
        // The test writes no config file for webpack to watch, and the
        // default points at one that does not exist here.
        buildDependencies: {},
      },
      module: {
        rules: [
          {
            test: /\.jpe?g$/i,
            type: "asset/resource",
            generator: { filename: "[name][ext]" },
          },
        ],
      },
    });

    return new Promise((resolve, reject) => {
      compiler.run((error, stats) => {
        if (error) {
          compiler.close(() => reject(error));

          return;
        }

        // Nothing is read here: on a webpack that cannot await, the build
        // reports an error and emits no bundle, and the caller checks that
        // before asking for one.
        const assets = Object.keys(stats.compilation.assets);
        const output = stats.compilation.outputOptions.path;

        compiler.close((closeError) => {
          if (closeError) {
            reject(closeError);

            return;
          }

          resolve({
            stats,
            assets,
            read: (name) =>
              compiler.outputFileSystem
                .readFileSync(path.join(output, name))
                .toString(),
          });
        });
      });
    });
  }

  it("should keep the rename when the module is restored from the pack", async () => {
    const first = await run();

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(getErrors(first.stats)).toEqual([]);
    expect(first.assets).toContain("image.webp");
    expect(toWebp.calls).toBe(1);

    const second = await run();

    expect(getErrors(second.stats)).toEqual([]);

    // The second compiler is a new one reading the pack the first wrote, so
    // the image module is restored rather than rebuilt. `assetResource` is
    // serialized with it, which is what has to carry the rename -- a
    // `matchResource` would not survive.
    expect(toWebp.calls).toBe(1);
    expect(moduleState(second.stats, "./image.jpg")).toEqual({
      cached: true,
      built: false,
    });
    expect(second.assets).toContain("image.webp");
    expect(second.assets).not.toContain("image.jpg");
    const bundle = second.read("main.js");

    expect(bundle).toContain('"image.webp"');
    expect(bundle).not.toContain('"image.jpg"');
  });

  it("should re-encode when the image changed between runs", async () => {
    const first = await run();

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(first.assets).toContain("image.webp");

    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("second"));

    const second = await run();

    expect(getErrors(second.stats)).toEqual([]);
    // New bytes, so neither the module nor the generator's own cache entry
    // may answer from the pack.
    expect(moduleState(second.stats, "./image.jpg").built).toBe(true);
    expect(toWebp.calls).toBe(2);
    expect(second.assets).toContain("image.webp");
    expect(second.assets).not.toContain("image.jpg");
  });

  it("should re-run a changed generator against a warm pack", async () => {
    const first = await run();

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(first.assets).toContain("image.webp");

    const second = await run({ generate: toAvif });

    expect(getErrors(second.stats)).toEqual([]);
    // Nothing per-module keys on the plugin, so without the generator in the
    // pack's version the restored module would keep the previous generator's
    // bytes and name.
    expect(toAvif.calls).toBe(1);
    expect(second.assets).toContain("image.avif");
    expect(second.assets).not.toContain("image.webp");
    expect(second.read("image.avif")).toBe("AVIF:first");
  });

  it("should re-run the generator when only its options changed", async () => {
    const first = await run({ generatorOptions: { quality: 50 } });

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(toWebp.calls).toBe(1);

    const second = await run({ generatorOptions: { quality: 90 } });

    expect(getErrors(second.stats)).toEqual([]);
    expect(toWebp.calls).toBe(2);
    expect(second.assets).toContain("image.webp");
  });

  it("should read every named generator for the identity", async () => {
    // `asset` generators need no awaitable hook, so this runs everywhere and
    // covers a salt built from more than one generator.
    const options = {
      generate: {
        webp: { implementation: toWebp, type: "asset" },
        avif: { implementation: toAvif, type: "asset" },
      },
    };
    const first = await run(options);

    expect(getErrors(first.stats)).toEqual([]);
    expect(first.assets).toContain("image.webp");
    expect(first.assets).toContain("image.avif");
    expect(toWebp.calls).toBe(1);
    expect(toAvif.calls).toBe(1);

    toWebp.calls = 0;
    toAvif.calls = 0;

    const second = await run(options);

    expect(getErrors(second.stats)).toEqual([]);
    expect(second.assets).toContain("image.webp");
    expect(second.assets).toContain("image.avif");
  });

  it("should read an array of generators for the identity too", async () => {
    const first = await run({ generate: [toWebp] });

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(first.assets).toContain("image.webp");
    expect(toWebp.calls).toBe(1);

    const second = await run({ generate: [toAvif] });

    expect(getErrors(second.stats)).toEqual([]);
    expect(toAvif.calls).toBe(1);
    expect(second.assets).toContain("image.avif");
    expect(second.assets).not.toContain("image.webp");
  });
});

describe("replaceExtension", () => {
  it.each([
    ["a/photo.jpg", "webp", "a/photo.webp"],
    // The request's query and fragment name the asset too, so only the
    // extension is the encoder's to change.
    ["photo.jpeg?w=100", "webp", "photo.webp?w=100"],
    ["a/b.png#frag", "avif", "a/b.avif#frag"],
    ["photo.png?w=1#frag", "webp", "photo.webp?w=1#frag"],
    // A dot in a directory name is not an extension.
    ["dir.x/readme", "png", "dir.x/readme.png"],
  ])("should rewrite %s to .%s", (name, extension, expected) => {
    expect(replaceExtension(name, extension)).toBe(expected);
  });
});

describe("what a generated file promises about its name", () => {
  /**
   * @param {string} filename the generator's filename template
   * @returns {Promise<import("webpack").AssetInfo>} what the generated file says
   */
  const infoFor = async (filename) => {
    const copy = (input) => ({
      code: Buffer.from(Object.values(input)[0]),
    });

    copy.supportsBinary = () => true;
    copy.supportsWorker = () => false;

    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      output: {
        path: path.resolve(__dirname, "./dist"),
        filename: "[name].[contenthash].js",
      },
      module: {
        rules: [
          {
            test: /\.(png|jpe?g|svg|webp)/i,
            type: "asset/resource",
            generator: { filename: "[name].[contenthash][ext]" },
          },
        ],
      },
    });

    new MinimizerPlugin({
      test: /\.png$/i,
      generate: { implementation: copy, type: "asset", filename },
    }).apply(compiler);

    const stats = await compile(compiler);
    const generated = Object.keys(stats.compilation.assets).find((name) =>
      name.includes(".copy"),
    );

    return stats.compilation.getAsset(generated).info;
  };

  it("should stay immutable where the name still carries the original's", async () => {
    const info = await infoFor("[path][name].copy[ext]");

    expect(info.immutable).toBe(true);
  });

  it("should not claim immutable where the name does not", async () => {
    const info = await infoFor("fixed.copy.png");

    // The original's promise rested on a hash in its name; a fixed name
    // carries none, so the file behind it can change.
    expect(info.immutable).toBeUndefined();
  });
});

describe("generate beside the minifier", () => {
  /**
   * @returns {EXPECTED_ANY} a generator that hands back what it read
   */
  const copier = () => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer }} the same bytes
     */
    const copy = (input) => {
      const [[name, code]] = Object.entries(input);

      copy.saw.push(name);

      return { code: Buffer.isBuffer(code) ? code : Buffer.from(code) };
    };

    copy.supportsBinary = () => true;
    copy.supportsWorker = () => false;
    copy.saw = [];

    return copy;
  };

  it("should read the `.js` default where no `test` was set", async () => {
    const copy = copier();
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      generate: {
        implementation: copy,
        type: "asset",
        filename: "[path][name].copy[ext]",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // The default is the plugin's, not the minifier's, so a generator written
    // for images is given a `test` that names them.
    expect(copy.saw).toEqual(["main.js"]);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should still honour a `test` that is set", async () => {
    const copy = copier();
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.png$/i,
      generate: {
        implementation: copy,
        type: "asset",
        filename: "[path][name].copy[ext]",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(copy.saw).toEqual(["image.png"]);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should minify as well as generate, and mark what it minified", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.(png|js)$/i,
      generate: {
        implementation: (input) => ({
          code: Buffer.from(Object.values(input)[0]),
        }),
        type: "asset",
        filename: "[path][name].copy[ext]",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // Both jobs run: the default minifier over the bundle, the generator over
    // what `test` named — and `terserMinify` declines the image itself.
    expect(readAsset("main.js", compiler, stats)).not.toContain("\n");
    expect(
      /** @type {import("webpack").Asset} */ (
        stats.compilation.getAsset("main.js")
      ).info.minimized,
    ).toBe(true);
    expect(
      /** @type {import("webpack").Asset} */ (
        stats.compilation.getAsset("image.png")
      ).info.minimized,
    ).toBeUndefined();
    expect(Object.keys(stats.compilation.assets)).toContain("image.copy.png");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should not rename a bundle where `minify` is an empty list", async () => {
    /**
     * @param {boolean} withPlugin whether to apply the plugin
     * @returns {Promise<string[]>} the emitted JavaScript names
     */
    const namesFrom = async (withPlugin) => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/images.js"),
        output: {
          path: path.resolve(__dirname, "./dist"),
          filename: "[name].[fullhash].js",
        },
        module: { rules: IMAGE_RULES },
      });

      if (withPlugin) {
        new MinimizerPlugin({
          test: /.*/,
          minify: [],
          generate: {
            implementation: (input) => ({
              code: Buffer.from(Object.values(input)[0]),
            }),
            type: "asset",
            filename: "[path][name].copy[ext]",
          },
        }).apply(compiler);
      }

      const stats = await compile(compiler);

      return Object.keys(stats.compilation.assets)
        .filter((name) => name.endsWith(".js") && !name.includes(".copy."))
        .sort();
    };

    // Nothing minifies, so nothing rewrites the bundle, so its name is the one
    // it would have carried without this plugin — `test` matching it or not.
    expect(await namesFrom(true)).toEqual(await namesFrom(false));
  });

  it("should minify nothing where `minify` is an empty list", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /.*/,
      minify: [],
      generate: {
        implementation: (input) => ({
          code: Buffer.from(Object.values(input)[0]),
        }),
        type: "asset",
        filename: "[path][name].copy[ext]",
      },
    }).apply(compiler);

    const stats = await compile(compiler);
    const bundle = /** @type {import("webpack").Asset} */ (
      stats.compilation.getAsset("main.js")
    );

    // No minimizers is a list with none in it rather than a missing one, so
    // the passes over them simply do nothing and the generators still run.
    expect(readAsset("main.js", compiler, stats)).toContain("\n");
    expect(bundle.info.minimized).toBeUndefined();
    expect(Object.keys(stats.compilation.assets)).toContain("image.copy.png");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should not rename a bundle no minimizer of its own would touch", async () => {
    /**
     * @param {boolean} withPlugin whether to apply the plugin
     * @returns {Promise<string[]>} the emitted JavaScript names
     */
    const namesFrom = async (withPlugin) => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/images.js"),
        output: {
          path: path.resolve(__dirname, "./dist"),
          filename: "[name].[fullhash].js",
        },
        module: { rules: IMAGE_RULES },
      });

      if (withPlugin) {
        new MinimizerPlugin({
          test: /\.png$/i,
          generate: {
            implementation: (input) => ({
              code: Buffer.from(Object.values(input)[0]),
            }),
            type: "asset",
            filename: "[path][name].copy[ext]",
          },
        }).apply(compiler);
      }

      const stats = await compile(compiler);

      return Object.keys(stats.compilation.assets)
        .filter((name) => name.endsWith(".js"))
        .sort();
    };

    // `test` names images, so no minimizer here is ever handed the bundle:
    // salting its hash would rename a file this instance never rewrites.
    expect(await namesFrom(true)).toEqual(await namesFrom(false));
  });

  it("should still rename when a minimizer would be handed the bundle", async () => {
    /**
     * @param {EXPECTED_ANY} minimizerOptions what to run terser with
     * @returns {Promise<string[]>} the emitted JavaScript names
     */
    const namesFrom = async (minimizerOptions) => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/images.js"),
        output: {
          path: path.resolve(__dirname, "./dist"),
          filename: "[name].[fullhash].js",
        },
        module: { rules: IMAGE_RULES },
      });

      new MinimizerPlugin({
        minimizerOptions,
        generate: {
          implementation: (input) => ({
            code: Buffer.from(Object.values(input)[0]),
          }),
          type: "asset",
          filename: "[path][name].copy[ext]",
        },
      }).apply(compiler);

      const stats = await compile(compiler);

      return Object.keys(stats.compilation.assets)
        .filter((name) => name.endsWith(".js"))
        .sort();
    };

    // The guard above must not cost the salt its job: what terser is run with
    // still varies the name of what it rewrote.
    expect(await namesFrom({ mangle: true })).not.toEqual(
      await namesFrom({ mangle: false }),
    );
  });

  it("should salt where a function names the file, which cannot be read ahead", async () => {
    /**
     * @param {boolean} withPlugin whether to apply the plugin
     * @returns {Promise<string[]>} the emitted JavaScript names
     */
    const namesFrom = async (withPlugin) => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/images.js"),
        output: {
          path: path.resolve(__dirname, "./dist"),
          filename: () => "[name].[fullhash].js",
        },
        module: { rules: IMAGE_RULES },
      });

      if (withPlugin) {
        new MinimizerPlugin({
          test: /\.png$/i,
          generate: {
            implementation: (input) => ({
              code: Buffer.from(Object.values(input)[0]),
            }),
            type: "asset",
            filename: "[path][name].copy[ext]",
          },
        }).apply(compiler);
      }

      const stats = await compile(compiler);

      return Object.keys(stats.compilation.assets)
        .filter((name) => name.endsWith(".js"))
        .sort();
    };

    // Nothing can be read off a function before it is called, so the salt
    // stands rather than being skipped on a guess.
    expect(await namesFrom(true)).not.toEqual(await namesFrom(false));
  });

  it("should still minify when only a generator was configured", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      generate: {
        implementation: (input) => ({
          code: Buffer.from(Object.values(input)[0]),
        }),
        type: "asset",
        filename: "[path][name].copy[ext]",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // Configuring a generator does not turn the minifier off.
    expect(readAsset("main.js", compiler, stats)).not.toContain("\n");
    expect(
      /** @type {import("webpack").Asset} */ (
        stats.compilation.getAsset("main.js")
      ).info.minimized,
    ).toBe(true);
    expect(getErrors(stats)).toEqual([]);
  });
});

describe("generate over a file that is already there", () => {
  it("should record `related` and delete the original even when the file exists", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    /** Writes the name the generator is about to write, before it runs. */
    class AlreadyThere {
      /**
       * @param {import("webpack").Compiler} instance compiler
       * @returns {void}
       */
      apply(instance) {
        instance.hooks.compilation.tap("AlreadyThere", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "AlreadyThere",
              stage:
                compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            () => {
              compilation.emitAsset(
                "image.copy.png",
                new compiler.webpack.sources.RawSource(Buffer.from("stale")),
              );
            },
          );
        });
      }
    }

    new AlreadyThere().apply(compiler);
    new MinimizerPlugin({
      test: /^image\.png$/i,
      generate: {
        implementation: (input) => ({
          code: Buffer.from(Object.values(input)[0]),
        }),
        type: "asset",
        filename: "[path][name].copy[ext]",
        relatedName: "copied",
        deleteOriginalAssets: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);
    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    // Written over rather than emitted, and the original still gone with it.
    expect(names).toContain("image.copy.png");
    expect(names).not.toContain("image.png");
    expect(readAsset("image.copy.png", compiler, stats)).not.toBe("stale");
  });

  it("should not keep what the name it wrote over promised", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    /** Writes the name the generator is about to write, and promises for it. */
    class AlreadyThere {
      /**
       * @param {import("webpack").Compiler} instance compiler
       * @returns {void}
       */
      apply(instance) {
        instance.hooks.compilation.tap("AlreadyThere", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "AlreadyThere",
              stage:
                compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            () => {
              compilation.emitAsset(
                "image.copy.png",
                new compiler.webpack.sources.RawSource(Buffer.from("stale")),
                { immutable: true, sourceFilename: "somewhere/else.png" },
              );
            },
          );
        });
      }
    }

    new AlreadyThere().apply(compiler);
    new MinimizerPlugin({
      test: /^image\.png$/i,
      generate: {
        implementation: (input) => ({
          code: Buffer.from(Object.values(input)[0]),
        }),
        type: "asset",
        filename: "[path][name].copy[ext]",
      },
    }).apply(compiler);

    const stats = await compile(compiler);
    const { info } = /** @type {import("webpack").Asset} */ (
      stats.compilation.getAsset("image.copy.png")
    );

    expect(getErrors(stats)).toEqual([]);
    // What the generator says of the file it wrote, and nothing the name
    // carried before it: webpack merges an info object into the old one.
    expect(info.immutable).toBeUndefined();
    expect(info.sourceFilename).toBeUndefined();
    expect(info.generated).toBe(true);
  });

  it("should record `related` on the original where it is kept", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    /** Writes the name the generator is about to write, before it runs. */
    class AlreadyThere {
      /**
       * @param {import("webpack").Compiler} instance compiler
       * @returns {void}
       */
      apply(instance) {
        instance.hooks.compilation.tap("AlreadyThere", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "AlreadyThere",
              stage:
                compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            () => {
              compilation.emitAsset(
                "image.copy.png",
                new compiler.webpack.sources.RawSource(Buffer.from("stale")),
              );
            },
          );
        });
      }
    }

    new AlreadyThere().apply(compiler);
    new MinimizerPlugin({
      test: /^image\.png$/i,
      generate: {
        implementation: (input) => ({
          code: Buffer.from(Object.values(input)[0]),
        }),
        type: "asset",
        filename: "[path][name].copy[ext]",
        relatedName: "copied",
      },
    }).apply(compiler);

    const stats = await compile(compiler);
    const original = /** @type {import("webpack").Asset} */ (
      stats.compilation.getAsset("image.png")
    );

    expect(getErrors(stats)).toEqual([]);
    expect(
      /** @type {{ [key: string]: string }} */ (original.info.related).copied,
    ).toBe("image.copy.png");
  });
});

describe("deleting the asset a file was written beside", () => {
  it("should keep the generated file when `relatedName` is set too", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /^image\.png$/i,
      generate: {
        implementation: (input) => ({
          code: Buffer.from(Object.values(input)[0]),
        }),
        type: "asset",
        filename: "[path][name].copy[ext]",
        relatedName: "copied",
        deleteOriginalAssets: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);
    const names = Object.keys(stats.compilation.assets);

    // Deleting an asset takes everything its `related` names with it, so the
    // two together must not delete the file that was just written.
    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.copy.png");
    expect(names).not.toContain("image.png");
  });

  it("should not mind a second generator having deleted it already", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    /**
     * @param {string} suffix what to name what it writes
     * @returns {EXPECTED_ANY} one generator
     */
    const copyTo = (suffix) => ({
      implementation: (input) => ({
        code: Buffer.from(Object.values(input)[0]),
      }),
      type: "asset",
      filename: `[path][name].${suffix}[ext]`,
      deleteOriginalAssets: true,
    });

    new MinimizerPlugin({
      test: /^image\.png$/i,
      generate: { one: copyTo("one"), two: copyTo("two") },
    }).apply(compiler);

    const stats = await compile(compiler);
    const names = Object.keys(stats.compilation.assets);

    // Both wrote, and whichever deleted second found nothing left to delete.
    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.one.png");
    expect(names).toContain("image.two.png");
    expect(names).not.toContain("image.png");
  });

  it("should leave the source map of the asset it deleted", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });

    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: string | Buffer }} the same bytes
     */
    const copy = (input) => ({ code: Object.values(input)[0] });

    copy.getStage = (
      /** @type {typeof import("webpack").Compilation} */ compilation,
    ) => compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER;

    new MinimizerPlugin({
      parallel: false,
      test: /\.js$/i,
      generate: {
        implementation: copy,
        type: "asset",
        filename: "[path][base].gz",
        deleteOriginalAssets: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // The map is `related` to the asset that went, and webpack deletes what an
    // asset's `related` names: the code it maps is served compressed, not gone.
    expect(getErrors(stats)).toEqual([]);
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js.gz",
      "one.js.map",
    ]);
  });

  it("should leave what another generator wrote beside it", async () => {
    const compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });

    /**
     * @param {string} suffix what to name what it writes
     * @param {EXPECTED_ANY} extra what else to say about it
     * @returns {EXPECTED_ANY} one generator
     */
    const copyTo = (suffix, extra) => ({
      implementation: (
        /** @type {{ [file: string]: string | Buffer }} */ input,
      ) => ({ code: Object.values(input)[0] }),
      type: "asset",
      filename: `[path][base]${suffix}`,
      ...extra,
    });

    new MinimizerPlugin({
      parallel: false,
      test: /\.js$/i,
      generate: {
        br: copyTo(".br", { relatedName: "brotli" }),
        gz: copyTo(".gz", { deleteOriginalAssets: true }),
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // The one deleting reads an original that names the other's file in its
    // `related`, and that file is nothing to do with the deletion.
    expect(getErrors(stats)).toEqual([]);
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js.br",
      "one.js.gz",
    ]);
  });

  it("should ask a function which of them to delete", async () => {
    const compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/entry.js"),
        two: path.resolve(__dirname, "./fixtures/entry.js"),
      },
    });

    new MinimizerPlugin({
      parallel: false,
      test: /\.js$/i,
      generate: {
        implementation: (
          /** @type {{ [file: string]: string | Buffer }} */ input,
        ) => ({ code: Object.values(input)[0] }),
        type: "asset",
        filename: "[path][base].gz",
        deleteOriginalAssets: (name) => name === "one.js",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js.gz",
      "two.js",
      "two.js.gz",
    ]);
  });

  it("should take a `filename` function for the name it writes", async () => {
    const compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });

    new MinimizerPlugin({
      parallel: false,
      test: /\.js$/i,
      minify: [],
      generate: {
        implementation: (input) => ({ code: Object.values(input)[0] }),
        type: "asset",
        filename: (pathData) => `${pathData.filename}.gz`,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "one.js",
      "one.js.gz",
    ]);
  });

  it("should not point a file written under the original's name at itself", async () => {
    const compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });

    new MinimizerPlugin({
      parallel: false,
      test: /\.js$/i,
      minify: [],
      generate: {
        implementation: (input) => ({
          code: `/* generated */${Object.values(input)[0]}`,
        }),
        type: "asset",
        filename: "[path][base]",
        relatedName: "generated",
      },
    }).apply(compiler);

    const stats = await compile(compiler);
    const { info } = /** @type {import("webpack").Asset} */ (
      stats.compilation.getAsset("one.js")
    );

    // Recording it would write the source back over what was just generated,
    // and the file has nowhere to point but at itself.
    expect(getErrors(stats)).toEqual([]);
    expect(info.related).toBeUndefined();
    expect(readAsset("one.js", compiler, stats)).toMatch(
      /^\/\* generated \*\//,
    );
  });

  it("should keep a file written under the original's own name", async () => {
    const compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });

    new MinimizerPlugin({
      parallel: false,
      test: /\.js$/i,
      generate: {
        implementation: (input) => ({
          code: `/* generated */${Object.values(input)[0]}`,
        }),
        type: "asset",
        filename: "[path][base]",
        deleteOriginalAssets: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // Re-encoding a file in place names it what it was called, so there is no
    // original left beside it to delete — only the file just written.
    expect(getErrors(stats)).toEqual([]);
    expect(Object.keys(stats.compilation.assets)).toEqual(["one.js"]);
    expect(readAsset("one.js", compiler, stats)).toMatch(
      /^\/\* generated \*\//,
    );
  });
});

describe("generate from an asset emitted late", () => {
  it("should generate from an asset added after the generators ran", async () => {
    const seen = [];
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer }} the same bytes
     */
    const copy = (input) => {
      const [[name, code]] = Object.entries(input);

      seen.push(name);

      return { code: Buffer.isBuffer(code) ? code : Buffer.from(code) };
    };

    copy.supportsBinary = () => true;
    copy.supportsWorker = () => false;

    class EmitLate {
      /**
       * @param {import("webpack").Compiler} inner compiler
       * @returns {void}
       */
      apply(inner) {
        const { RawSource } = inner.webpack.sources;

        inner.hooks.compilation.tap("EmitLate", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "EmitLate",
              stage: compilation.constructor.PROCESS_ASSETS_STAGE_REPORT,
            },
            () => {
              compilation.emitAsset("late.txt", new RawSource("late bytes"));
            },
          );
        });
      }
    }

    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new EmitLate().apply(compiler);
    new MinimizerPlugin({
      test: /\.txt$/i,
      generate: {
        implementation: copy,
        type: "asset",
        filename: "[path][name].copy[ext]",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // The tap is re-invoked for what arrives after it first ran, so a file
    // another plugin adds late still gets the one that belongs beside it.
    expect(seen).toContain("late.txt");
    expect(Object.keys(stats.compilation.assets)).toContain("late.copy.txt");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should offer each asset once, and never a file of its own making", async () => {
    const minified = [];
    const generated = [];

    /**
     * @param {string[]} seen where to record what it was handed
     * @returns {(input: { [file: string]: string | Buffer }) => { code: string | Buffer }} the function
     */
    const recording = (seen) => (input) => {
      const [[name, code]] = Object.entries(input);

      seen.push(name);

      return { code };
    };

    class EmitLate {
      /**
       * @param {import("webpack").Compiler} inner compiler
       * @returns {void}
       */
      apply(inner) {
        const { RawSource } = inner.webpack.sources;

        inner.hooks.compilation.tap("EmitLate", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "EmitLate",
              stage: compilation.constructor.PROCESS_ASSETS_STAGE_REPORT,
            },
            () => {
              if (!compilation.getAsset("late.js")) {
                compilation.emitAsset(
                  "late.js",
                  new RawSource("var late = 1;"),
                );
              }
            },
          );
        });
      }
    }

    const generate = recording(generated);

    generate.getStage = (
      /** @type {typeof import("webpack").Compilation} */ compilation,
    ) => compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER;

    const compiler = getCompiler({
      entry: { one: path.resolve(__dirname, "./fixtures/entry.js") },
    });

    new EmitLate().apply(compiler);
    new MinimizerPlugin({
      parallel: false,
      test: /.*/,
      minify: recording(minified),
      generate: {
        implementation: generate,
        type: "asset",
        filename: "[path][base].gz",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    // Each asset once to each pass, `late.js` included — and `one.js.gz`, which
    // the generator wrote, to neither: minifying it is what it is not.
    expect(minified).toEqual(["one.js", "late.js"]);
    expect(generated).toEqual(["one.js", "late.js"]);
    expect(Object.keys(stats.compilation.assets).sort()).toEqual([
      "late.js",
      "late.js.gz",
      "one.js",
      "one.js.gz",
    ]);
    expect(getErrors(stats)).toEqual([]);
  });
});

describe("generate assets, what is worth writing", () => {
  /**
   * A generator that pads or shrinks what it read, so `threshold` and
   * `minRatio` can be driven from a known size.
   * @param {number} factor how much of the input to hand back
   * @returns {EXPECTED_ANY} the generator
   */
  const scaleBy = (factor) => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer }} the scaled result
     */
    const scale = (input) => {
      const [[, code]] = Object.entries(input);
      const bytes = Buffer.isBuffer(code) ? code : Buffer.from(code);

      scale.calls += 1;

      return {
        code:
          factor <= 1
            ? bytes.subarray(0, Math.ceil(bytes.length * factor))
            : Buffer.concat([bytes, Buffer.alloc(bytes.length * (factor - 1))]),
      };
    };

    scale.supportsBinary = () => true;
    scale.supportsWorker = () => false;
    scale.calls = 0;

    return scale;
  };

  /**
   * @param {object} descriptor extra generator descriptor keys
   * @param {EXPECTED_ANY} implementation the generator
   * @returns {Promise<EXPECTED_ANY>} what the build produced
   */
  const build = async (descriptor, implementation) => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.png$/i,
      generate: {
        implementation,
        type: "asset",
        filename: "[path][name].copy[ext]",
        ...descriptor,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    return { compiler, stats, assets: Object.keys(stats.compilation.assets) };
  };

  it("should skip an asset smaller than `threshold`", async () => {
    const scale = scaleBy(1);
    const { stats, assets } = await build({ threshold: 1024 * 1024 }, scale);

    // Nothing is even read: the size is known before the generator runs.
    expect(scale.calls).toBe(0);
    expect(assets).not.toContain("image.copy.png");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should generate from an asset larger than `threshold`", async () => {
    const scale = scaleBy(1);
    const { stats, assets } = await build({ threshold: 1024 }, scale);

    expect(scale.calls).toBe(1);
    expect(assets).toContain("image.copy.png");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should drop a result that is not `minRatio` smaller", async () => {
    const scale = scaleBy(2);
    const { stats, assets } = await build({ minRatio: 0.8 }, scale);

    // It ran and its answer was twice the size, so keeping it would cost a
    // request to serve more bytes than the file it came from.
    expect(scale.calls).toBe(1);
    expect(assets).not.toContain("image.copy.png");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should keep a result that is `minRatio` smaller", async () => {
    const scale = scaleBy(0.5);
    const { stats, assets } = await build({ minRatio: 0.8 }, scale);

    expect(assets).toContain("image.copy.png");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should record the generated asset under `relatedName`", async () => {
    const { stats } = await build({ relatedName: "copied" }, scaleBy(1));

    // The original points at it, which is how a server asked for the original
    // finds the file beside it.
    expect(stats.compilation.getAsset("image.png").info.related.copied).toBe(
      "image.copy.png",
    );
    expect(getErrors(stats)).toEqual([]);
  });

  it("should leave an asset already carrying that key alone", async () => {
    const scale = scaleBy(1);
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    class AlreadyCopied {
      /**
       * @param {import("webpack").Compiler} inner compiler
       * @returns {void}
       */
      apply(inner) {
        inner.hooks.compilation.tap("AlreadyCopied", (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: "AlreadyCopied",
              stage: compilation.constructor.PROCESS_ASSETS_STAGE_ADDITIONS,
            },
            (assets) => {
              for (const name of Object.keys(assets)) {
                if (/\.png$/i.test(name)) {
                  compilation.updateAsset(name, (one) => one, {
                    related: { copied: "elsewhere.png" },
                  });
                }
              }
            },
          );
        });
      }
    }

    new AlreadyCopied().apply(compiler);
    new MinimizerPlugin({
      test: /\.png$/i,
      generate: {
        implementation: scale,
        type: "asset",
        filename: "[path][name].copy[ext]",
        relatedName: "copied",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(scale.calls).toBe(0);
    expect(getErrors(stats)).toEqual([]);
  });
});

describe("generate assets, byte for byte", () => {
  const PREFIX = "/* prepended */";

  /**
   * Puts an asset behind a source that holds text and bytes at once, which is
   * what any plugin prepending to a file leaves behind. Such a source answers
   * `source()` with a string, and bytes over 0x7f do not survive that.
   */
  class PrependText {
    /**
     * @param {import("webpack").Compiler} compiler compiler
     * @returns {void}
     */
    apply(compiler) {
      const { ConcatSource, RawSource } = compiler.webpack.sources;

      compiler.hooks.compilation.tap("PrependText", (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: "PrependText",
            stage: compilation.constructor.PROCESS_ASSETS_STAGE_ADDITIONS,
          },
          (assets) => {
            for (const name of Object.keys(assets)) {
              if (!/\.png$/i.test(name)) {
                continue;
              }

              compilation.updateAsset(
                name,
                (source) => new ConcatSource(new RawSource(PREFIX), source),
              );
            }
          },
        );
      });
    }
  }

  /**
   * A generator that hands back exactly the bytes it was given, so anything
   * the test sees moving is the plugin's doing rather than the generator's.
   * @returns {EXPECTED_ANY} the generator
   */
  const passthrough = () => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer }} the same bytes
     */
    const copy = (input) => {
      const [[, code]] = Object.entries(input);

      copy.saw = Buffer.isBuffer(code) ? code : Buffer.from(code);

      return { code: copy.saw };
    };

    copy.supportsBinary = () => true;
    copy.supportsWorker = () => false;
    copy.saw = undefined;

    return copy;
  };

  /**
   * @param {EXPECTED_ANY} copy the generator to run
   * @returns {Promise<EXPECTED_ANY>} what the build produced
   */
  const build = async (copy) => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new PrependText().apply(compiler);
    new MinimizerPlugin({
      test: /\.png$/i,
      generate: {
        implementation: copy,
        type: "asset",
        filename: "[path][name].copy[ext]",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    return { compiler, stats };
  };

  const expected = () =>
    Buffer.concat([
      Buffer.from(PREFIX),
      fs.readFileSync(path.resolve(__dirname, "./fixtures/image.png")),
    ]);

  it("should hand a generator an image's real bytes", async () => {
    const copy = passthrough();
    const { stats } = await build(copy);
    const want = expected();

    // Read as text, every byte over 0x7f comes back as U+FFFD and the file
    // grows: the bytes have to reach the generator as bytes.
    expect(copy.saw).toBeDefined();
    expect(copy.saw).toHaveLength(want.length);
    expect(copy.saw.equals(want)).toBe(true);
    expect(getErrors(stats)).toEqual([]);
  });

  it("should write the generated image out unchanged", async () => {
    const copy = passthrough();
    const { compiler, stats } = await build(copy);
    const written = Object.keys(stats.compilation.assets).find((name) =>
      name.endsWith(".copy.png"),
    );

    expect(written).toBeDefined();
    expect(
      compiler.outputFileSystem
        .readFileSync(path.join(stats.compilation.outputOptions.path, written))
        .equals(expected()),
    ).toBe(true);
    expect(getErrors(stats)).toEqual([]);
  });
});
