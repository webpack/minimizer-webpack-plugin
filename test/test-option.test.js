import path from "path";

import MinimizerPlugin from "../src/index";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

describe("test option", () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: {
        js: path.resolve(__dirname, "./fixtures/entry.js"),
        mjs: path.resolve(__dirname, "./fixtures/entry.mjs"),
        importExport: path.resolve(
          __dirname,
          "./fixtures/import-export/entry.js",
        ),
        AsyncImportExport: path.resolve(
          __dirname,
          "./fixtures/async-import-export/entry.js",
        ),
      },
      output: {
        path: path.resolve(__dirname, "./dist"),
        filename: "[name].js?var=[fullhash]",
        chunkFilename: "[id].[name].js?ver=[fullhash]",
      },
    });
  });

  it("should match snapshot with empty value", async () => {
    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot for a single `test` value ({RegExp})", async () => {
    new MinimizerPlugin({
      test: /(m)?js\.js(\?.*)?$/i,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for a single "test" value ({String})', async () => {
    new MinimizerPlugin({
      test: "js.js",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for multiple "test" values ({RegExp})', async () => {
    new MinimizerPlugin({
      test: [/(m)?js\.js(\?.*)?$/i, /AsyncImportExport\.js(\?.*)?$/i],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for multiple "test" values ({String})', async () => {
    new MinimizerPlugin({
      test: ["js.js", "AsyncImportExport.js"],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and uglify "mjs"', async () => {
    compiler = getCompiler({
      entry: {
        js: path.resolve(__dirname, "./fixtures/entry.js"),
        mjs: path.resolve(__dirname, "./fixtures/entry.mjs"),
        importExport: path.resolve(
          __dirname,
          "./fixtures/import-export/entry.js",
        ),
        AsyncImportExport: path.resolve(
          __dirname,
          "./fixtures/async-import-export/entry.js",
        ),
      },
      output: {
        path: path.resolve(__dirname, "./dist"),
        filename: "[name].mjs?var=[fullhash]",
        chunkFilename: "[id].[name].mjs?ver=[fullhash]",
      },
    });

    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should minify assets whose names carry a fragment", async () => {
    // webpack names an asset module `[hash][ext][query][fragment]` by default,
    // and `output.filename` may hold a `#` too; neither is on disk.
    compiler = getCompiler({
      entry: {
        js: path.resolve(__dirname, "./fixtures/fragment-assets.js"),
        mjs: path.resolve(__dirname, "./fixtures/entry.mjs"),
      },
      output: {
        path: path.resolve(__dirname, "./dist"),
        filename: (pathData) =>
          pathData.chunk.name === "mjs"
            ? "[name].mjs#[fullhash]"
            : "[name].js#[fullhash]",
        assetModuleFilename: "[name][ext][query][fragment]",
      },
    });

    new MinimizerPlugin({
      test: /\.(?:[cm]?js|json)$/i,
      minify: [MinimizerPlugin.terserMinify, MinimizerPlugin.jsonMinify],
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = readsAssets(compiler, stats);
    const names = Object.keys(assets);

    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^js\.js#[0-9a-f]+$/),
        expect.stringMatching(/^mjs\.mjs#[0-9a-f]+$/),
        "file.json#data",
      ]),
    );

    for (const name of names) {
      if (/\.(?:[cm]?js|json)#/.test(name)) {
        expect(stats.compilation.getAsset(name).info.minimized).toBe(true);
        expect(assets[name]).not.toMatch(/\n/);
      }
    }

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should let each built-in `filter` accept a name with a fragment", () => {
    const accepted = [
      [MinimizerPlugin.terserMinify, "main.js#abc"],
      [MinimizerPlugin.terserMinify, "main.mjs?v=1#abc"],
      [MinimizerPlugin.uglifyJsMinify, "main.cjs#abc"],
      [MinimizerPlugin.swcMinify, "main.js#abc"],
      [MinimizerPlugin.esbuildMinify, "main.js#abc"],
      [MinimizerPlugin.jsonMinify, "data.json#abc"],
      [MinimizerPlugin.htmlMinifierTerser, "page.html#top"],
      [MinimizerPlugin.minifyHtmlNode, "page.htm#top"],
      [MinimizerPlugin.swcMinifyHtml, "page.html#top"],
      [MinimizerPlugin.swcMinifyHtmlFragment, "page.html#top"],
      [MinimizerPlugin.cssnanoMinify, "style.css#dark"],
      [MinimizerPlugin.cssoMinify, "style.css#dark"],
      [MinimizerPlugin.cleanCssMinify, "style.css#dark"],
      [MinimizerPlugin.esbuildMinifyCss, "style.css#dark"],
      [MinimizerPlugin.lightningCssMinify, "style.css#dark"],
      [MinimizerPlugin.swcMinifyCss, "style.css#dark"],
      [MinimizerPlugin.svgoMinify, "icon.svg#id"],
      [MinimizerPlugin.imageminMinify, "photo.png#x"],
      [MinimizerPlugin.imageminGenerate, "photo.png#x"],
      [MinimizerPlugin.sharpMinify, "photo.png#x"],
      [MinimizerPlugin.sharpGenerate, "photo.png#x"],
      [MinimizerPlugin.napiRsImageMinify, "photo.png#x"],
    ];

    for (const [minimizer, name] of accepted) {
      expect(minimizer.filter(name)).toBe(true);
      // The fragment is not an extension: `x.js#.css` stays JavaScript.
      expect(minimizer.filter(`other.txt#${name}`)).toBe(false);
    }
  });
});
