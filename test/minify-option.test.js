import path from "path";

import TerserPlugin from "../src";

import {
  BrokenCodePlugin,
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

describe("minify option", () => {
  it("should work", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      terserOptions: {
        keep_fnames: true,
        mangle: {
          reserved: ["baz"],
        },
      },
      minify(file, inputSourceMap, minimizerOptions) {
        return require("terser").minify(file, minimizerOptions);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work when the "parallel" option is "true"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      parallel: true,
      minify(file, inputSourceMap, minimizerOptions) {
        return require("terser").minify(file, minimizerOptions);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work when the "parallel" option is "false"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      parallel: false,
      minify(file, inputSourceMap, minimizerOptions) {
        return require("terser").minify(file, minimizerOptions);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should throw an error when an error", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify() {
        throw new Error("Error");
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should throw an error when an error when the "parallel" option is "true"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      parallel: true,
      minify: () => {
        throw new Error("Error");
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should throw an error when an error when the "parallel" option is "false"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      parallel: false,
      minify: () => {
        throw new Error("Error");
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should output errors and warning", async () => {
    const compiler = getCompiler();

    new TerserPlugin({
      minify: () => ({
        code: "1",
        errors: ["error"],
        warnings: ["warning"],
      }),
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should snapshot with extracting comments", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es5.js"),
      output: {
        path: path.resolve(__dirname, "./dist-uglify-js"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      extractComments: true,
      async minify(file) {
        const result = await require("terser").minify(file, {
          mangle: {
            reserved: ["baz"],
          },
        });

        return { ...result, extractedComments: ["/* Foo */"] };
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work with source maps", async () => {
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
      minify(file, sourceMap) {
        const terserOption = {
          mangle: {
            reserved: ["baz"],
          },
        };

        if (sourceMap) {
          terserOption.sourceMap = {
            content: sourceMap,
          };
        }

        return require("terser").minify(file, terserOption);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work with "uglify-js" minimizer', async () => {
    const compiler = getCompiler({
      target: ["es5", "web"],
      entry: path.resolve(__dirname, "./fixtures/minify/es5.js"),
      output: {
        path: path.resolve(__dirname, "./dist-uglify-js"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify(file) {
        return require("uglify-js").minify(file, {
          mangle: {
            reserved: ["baz"],
          },
        });
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work with "terser" minimizer', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify(file) {
        return require("terser").minify(file, {
          mangle: {
            reserved: ["baz"],
          },
        });
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work with custom minimize function and support warnings and errors", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify(file) {
        const isOldNodeJs = process.version.match(/^v(\d+)/)[1] === "10";
        const [[, code]] = Object.entries(file);

        return {
          code,
          warnings: [
            isOldNodeJs
              ? new Error("Warning 1").toString()
              : new Error("Warning 1"),
            "Warnings 2",
          ],
          errors: [
            isOldNodeJs ? "Error 1" : new Error("Error 1"),
            "Error 2",
            { message: "Error 3" },
            { message: "Error 4", filename: "foo.js" },
            { message: "Error 5", filename: "foo.js", line: 0, col: 0 },
            { message: "Error 6", filename: "foo.js", line: 1, col: 1 },
          ],
        };
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify`", async () => {
    const compiler = getCompiler();

    new TerserPlugin({
      minify: TerserPlugin.terserMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and generate source maps", async () => {
    const compiler = getCompiler({ devtool: "source-map" });

    new TerserPlugin({
      minify: TerserPlugin.terserMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and allows to set `terser` options", async () => {
    const compiler = getCompiler();

    new TerserPlugin({
      minify: TerserPlugin.terserMinify,
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and ECMA modules output", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.mjs"),
      output: {
        library: {
          type: "module",
        },
        pathinfo: false,
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
      experiments: {
        outputModule: true,
      },
    });

    new TerserPlugin({
      minify: TerserPlugin.terserMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and output errors", async () => {
    const compiler = getCompiler();

    new BrokenCodePlugin().apply(compiler);

    new TerserPlugin({
      minify: TerserPlugin.terserMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and extract comments by default", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new TerserPlugin({
      minify: TerserPlugin.terserMinify,
      extractComments: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and keep legal comments when extract comments is disabled", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new TerserPlugin({
      minify: TerserPlugin.terserMinify,
      extractComments: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and allows to disable `compress` options", async () => {
    const compiler = getCompiler();

    new TerserPlugin({
      minify: TerserPlugin.terserMinify,
      terserOptions: {
        compress: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify`", async () => {
    const compiler = getCompiler({
      target: ["web", "es5"],
    });

    new TerserPlugin({
      minify: TerserPlugin.uglifyJsMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and generate source maps", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      target: ["web", "es5"],
    });

    new TerserPlugin({
      minify: TerserPlugin.uglifyJsMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and allows to set `uglify-js` options", async () => {
    const compiler = getCompiler({
      target: ["web", "es5"],
    });

    new TerserPlugin({
      minify: TerserPlugin.uglifyJsMinify,
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  // `uglify-js` doesn't support ECMA modules

  it("should work using when the `minify` option is `uglifyJsMinify` and output errors", async () => {
    const compiler = getCompiler({
      target: ["web", "es5"],
      bail: false,
    });

    new BrokenCodePlugin().apply(compiler);

    new TerserPlugin({
      minify: TerserPlugin.uglifyJsMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and output warnings", async () => {
    const compiler = getCompiler({
      target: ["web", "es6"],
    });

    new TerserPlugin({
      minify: TerserPlugin.uglifyJsMinify,
      terserOptions: {
        warnings: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and extract comments by default", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
      target: ["web", "es5"],
    });

    new TerserPlugin({
      minify: TerserPlugin.uglifyJsMinify,
      extractComments: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and keep legal comments when extract comments is disabled", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
      target: ["web", "es5"],
    });

    new TerserPlugin({
      minify: TerserPlugin.uglifyJsMinify,
      extractComments: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify`", async () => {
    const compiler = getCompiler();

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and generate source maps", async () => {
    const compiler = getCompiler({ devtool: "source-map" });

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and allows to set `swc` options", async () => {
    const compiler = getCompiler();

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and ECMA modules output", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.mjs"),
      output: {
        library: {
          type: "module",
        },
        pathinfo: false,
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
      experiments: {
        outputModule: true,
      },
    });

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and output errors", async () => {
    const compiler = getCompiler({
      target: ["web", "es5"],
      bail: false,
    });

    new BrokenCodePlugin().apply(compiler);

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(
      getErrors(stats).map((item) => item.replace(" [GenericFailure]", "")),
    ).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and extract comments by default", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(stats.compilation.errors).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and extract comments using object options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
      extractComments: {
        condition: "all",
        filename: "licenses.txt",
        banner: "For license information please see licenses.txt",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and keep legal comments when extract comments is disabled", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
      extractComments: /moon/,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should report an error when the `extractComments` option for `swcMinify` uses a function condition", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
      bail: false,
    });

    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
      parallel: false,
      extractComments: {
        condition: () => true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify`", async () => {
    const compiler = getCompiler();

    new TerserPlugin({
      minify: TerserPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and generate source maps", async () => {
    const compiler = getCompiler({ devtool: "source-map" });

    new TerserPlugin({
      minify: TerserPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(stats.compilation.errors).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and allows to set `esbuild` options", async () => {
    const compiler = getCompiler();

    new TerserPlugin({
      minify: TerserPlugin.esbuildMinify,
      terserOptions: {
        minify: false,
        minifyWhitespace: true,
        minifyIdentifiers: false,
        minifySyntax: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and ECMA modules output", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.mjs"),
      output: {
        library: {
          type: "module",
        },
        pathinfo: false,
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
      experiments: {
        outputModule: true,
      },
    });

    new TerserPlugin({
      minify: TerserPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and output errors", async () => {
    const compiler = getCompiler();

    new BrokenCodePlugin().apply(compiler);

    new TerserPlugin({
      minify: TerserPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `jsonMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/json.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.json$/i,
      minify: TerserPlugin.jsonMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `jsonMinify` and allows to set `JSON.stringify` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/json.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.json$/i,
      minify: TerserPlugin.jsonMinify,
      terserOptions: { space: 4, replacer: null },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `jsonMinify` and output errors", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/json-error.js"),
    });

    new TerserPlugin().apply(compiler);
    new TerserPlugin({
      test: /\.json$/i,
      minify: TerserPlugin.jsonMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(stats.compilation.errors[0].message).toContain("Unexpected token");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  // Due `esbuild` doesn't support extract comments we keep legal comments by default
  it("should work using when the `minify` option is `esbuildMinify` and keep legal comments when extract comments is disabled", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new TerserPlugin({
      minify: TerserPlugin.esbuildMinify,
      terserOptions: {
        legalComments: "inline",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and output well formatted warnings", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/warning.js"),
    });

    new TerserPlugin({
      minify: TerserPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work when `minify` is an array of functions", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify: [
        (file, sourceMap, minimizerOptions) =>
          require("terser").minify(file, minimizerOptions),
        async (file) => {
          const [code] = Object.values(file);

          return { code: `${code}\n/* Appended by second minimizer */` };
        },
      ],
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work when `minify` and `terserOptions` are both arrays", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new TerserPlugin({
      minify: [
        (file, sourceMap, minimizerOptions) =>
          require("terser").minify(file, minimizerOptions),
        (file, sourceMap, minimizerOptions) =>
          require("terser").minify(file, minimizerOptions),
      ],
      terserOptions: [
        { mangle: false },
        { mangle: true, compress: { passes: 2 } },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should merge warnings and errors from all minimizers in an array", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    });

    new TerserPlugin({
      parallel: false,
      minify: [
        async (file) => ({
          code: Object.values(file)[0],
          warnings: ["warning from first"],
          errors: ["error from first"],
        }),
        async (file) => ({
          code: Object.values(file)[0],
          warnings: ["warning from second"],
          errors: ["error from second"],
        }),
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should error when the minimizer returns only warnings (no code)", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    });

    new TerserPlugin({
      parallel: false,
      minify: async () => ({ warnings: ["just a warning, no code"] }),
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should error when the minimizer returns only extracted comments (no code)", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    });

    new TerserPlugin({
      parallel: false,
      minify: async () => ({
        extractedComments: ["/*! @license from no-code minimizer */"],
      }),
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should carry the last good code forward when a step in the array returns no code", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    });

    new TerserPlugin({
      parallel: false,
      minify: [
        (file, sourceMap, minimizerOptions) =>
          require("terser").minify(file, minimizerOptions),
        // Middle step returns only a warning - next step must get the previous code
        async () => ({ warnings: ["middle step did nothing"] }),
        async (file) => {
          const [code] = Object.values(file);

          return { code: `${code}\n/* Appended after skipped middle step */` };
        },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });
});
