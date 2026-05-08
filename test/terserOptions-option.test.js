import path from "path";

import MinimizerPlugin from "../src/index";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

describe("terserOptions option", () => {
  it('should match snapshot for the "ecma" and set the option depending on the "output.environment" option ("es3")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
      target: ["web", "es3"],
    });

    new MinimizerPlugin({
      terserOptions: {
        mangle: false,
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" and set the option depending on the "output.environment" option ("es5")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      terserOptions: {
        mangle: false,
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" and set the option depending on the "output.environment" option ("es2020")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
      target: ["web", "es2020"],
    });

    new MinimizerPlugin({
      terserOptions: {
        mangle: false,
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" option with the "5" value', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
    });

    new MinimizerPlugin({
      terserOptions: {
        ecma: 5,
        mangle: false,
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" option with the "5" value ("swc")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
      terserOptions: {
        ecma: 5,
        mangle: false,
        format: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" option with the "6" value', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-6/entry.js"),
    });

    new MinimizerPlugin({
      terserOptions: {
        ecma: 6,
        mangle: false,
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" option with the "6" value ("swc")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-6/entry.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
      terserOptions: {
        ecma: 6,
        mangle: false,
        format: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" option with the "7" value', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-7/entry.js"),
    });

    new MinimizerPlugin({
      terserOptions: {
        ecma: 7,
        mangle: false,
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" option with the "8" value', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-8/entry.js"),
    });

    new MinimizerPlugin({
      terserOptions: {
        ecma: 8,
        mangle: false,
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "parse.ecma" option with the "8" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        parse: {
          ecma: 8,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "compress" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        compress: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "compress" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        compress: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "compress" option with an object value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        compress: {
          join_vars: false,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "mangle" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "mangle" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        mangle: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "mangle" option with object values', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        mangle: {
          reserved: ["baz"],
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "module" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        module: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "module" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        module: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "output.beautify" option with "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "output.comments" option with the "true"', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        output: {
          comments: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "format.beautify" option with "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        format: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "format.comments" option with the "true"', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        format: {
          comments: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "toplevel" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        toplevel: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "toplevel" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        toplevel: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "nameCache" option with a empty object value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        nameCache: {},
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ie8" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        ie8: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ie8" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        ie8: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "keep_classnames" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        keep_classnames: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "keep_classnames" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        keep_classnames: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "keep_fnames" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        keep_fnames: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "keep_fnames" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        keep_fnames: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "safari10" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        safari10: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "safari10" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        safari10: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "unknown" option', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      parallel: false,
      terserOptions: {
        output: {
          unknown: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });
});
