import path from "path";

import TerserPlugin from "../src";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

// This file is excluded from `testPathIgnorePatterns` in `jest.config.js`
// when `process.versions.node` is older than 18 or the platform is
// Windows, because the bundled CSS minimizers (cssnano@7, @swc/css,
// `lightningcss`, `esbuild@0.27`) require modern Node and don't reliably
// install on the Windows agents.

describe("css minify option", () => {
  it("should work using when the `minify` option is `cssnanoMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.cssnanoMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `cssnanoMinify` and allows to set `cssnano` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.cssnanoMinify,
      minimizerOptions: { preset: ["default", { discardComments: false }] },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `cssoMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.cssoMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `cssoMinify` and allows to set `csso` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.cssoMinify,
      minimizerOptions: { comments: false },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `cleanCssMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.cleanCssMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `cleanCssMinify` and allows to set `clean-css` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.cleanCssMinify,
      minimizerOptions: { format: "beautify" },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinifyCss`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.esbuildMinifyCss,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `lightningCssMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.lightningCssMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinifyCss`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: TerserPlugin.swcMinifyCss,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work when `minify` is an array of functions using `cssnanoMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: [
        TerserPlugin.cssnanoMinify,
        // Second pass: pass-through that asserts the previous minimizer
        // produced a string we can keep working with.
        (data) => {
          const [[, code]] = Object.entries(data);

          return { code };
        },
      ],
      minimizerOptions: [{ preset: "default" }, {}],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work and merge source maps when `minify` is an array of `terserMinify` minimizers", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify: [TerserPlugin.terserMinify, TerserPlugin.terserMinify],
      minimizerOptions: [{ mangle: false }, { mangle: true }],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work and merge source maps when `minify` mixes `terserMinify` with `uglifyJsMinify`", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify: [TerserPlugin.terserMinify, TerserPlugin.uglifyJsMinify],
      minimizerOptions: [{ mangle: false }, { mangle: true }],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work and merge source maps when `minify` is an array of CSS minimizers", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: [TerserPlugin.cssnanoMinify, TerserPlugin.cssnanoMinify],
      minimizerOptions: [{ preset: "default" }, { preset: "default" }],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work and merge source maps when `minify` mixes `terserMinify` with `swcMinify`", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify: [TerserPlugin.terserMinify, TerserPlugin.swcMinify],
      minimizerOptions: [{ mangle: false }, {}],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work and merge source maps when `minify` mixes `terserMinify` with `esbuildMinify`", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify: [TerserPlugin.terserMinify, TerserPlugin.esbuildMinify],
      minimizerOptions: [{ mangle: false }, {}],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  // The chain runs through every CSS minimizer; `esbuild` is the
  // tightest constraint at Node >=18.
  it("should work and merge source maps when `minify` mixes CSS minimizers using `cssnano`, `csso`, `cleanCss`, `lightningCss`, `swcCss`, and `esbuild`", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      entry: path.resolve(__dirname, "./fixtures/css.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.css(\?.*)?$/i,
      minify: [
        TerserPlugin.cssnanoMinify,
        TerserPlugin.cssoMinify,
        TerserPlugin.cleanCssMinify,
        TerserPlugin.lightningCssMinify,
        TerserPlugin.swcMinifyCss,
        TerserPlugin.esbuildMinifyCss,
      ],
      minimizerOptions: [{ preset: "default" }, {}, {}, {}, {}, {}],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });
});
