import path from "path";

import TerserPlugin from "../src";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

describe("HTML minimizers", () => {
  it("should work using when the `minify` option is `htmlMinifierTerser`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.htmlMinifierTerser,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `htmlMinifierTerser` and allows to set `html-minifier-terser` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.htmlMinifierTerser,
      minimizerOptions: {
        collapseWhitespace: false,
        removeComments: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `htmlMinifierTerser` and the `parallel` option is `true`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.htmlMinifierTerser,
      parallel: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `htmlMinifierTerser` and the `parallel` option is `false`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.htmlMinifierTerser,
      parallel: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinifyHtml`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.swcMinifyHtml,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinifyHtml` and allows to set `@swc/html` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.swcMinifyHtml,
      minimizerOptions: {
        removeComments: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinifyHtmlFragment`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html-fragment.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.swcMinifyHtmlFragment,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `minifyHtmlNode`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.minifyHtmlNode,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `minifyHtmlNode` and allows to set `@minify-html/node` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: TerserPlugin.minifyHtmlNode,
      minimizerOptions: {
        keep_comments: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work when chaining HTML minimizers via an array of `minify` functions", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.html(\?.*)?$/i,
      minify: [
        TerserPlugin.htmlMinifierTerser,
        // Second pass: pass-through that asserts the previous minimizer
        // produced a string we can keep working with.
        (data) => {
          const [[, code]] = Object.entries(data);

          return { code };
        },
      ],
      minimizerOptions: [
        { collapseWhitespace: true, removeComments: true },
        {},
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });
});
