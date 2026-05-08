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
});
