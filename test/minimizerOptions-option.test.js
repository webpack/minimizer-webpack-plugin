import path from "path";

import MinimizerPlugin from "../src/index";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

describe("minimizerOptions option", () => {
  it("should accept `minimizerOptions` and apply them like `terserOptions`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      minimizerOptions: {
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

  it("should treat `terserOptions` as a deprecated alias of `minimizerOptions`", () => {
    const pluginA = new MinimizerPlugin({
      minimizerOptions: { mangle: false },
    });
    const pluginB = new MinimizerPlugin({
      terserOptions: { mangle: false },
    });

    expect(pluginA.options.minimizer.options).toEqual(
      pluginB.options.minimizer.options,
    );
  });

  it("should prefer `minimizerOptions` when both `minimizerOptions` and `terserOptions` are provided", () => {
    const plugin = new MinimizerPlugin({
      minimizerOptions: { mangle: false },
      terserOptions: { mangle: true, compress: false },
    });

    expect(plugin.options.minimizer.options).toEqual({ mangle: false });
  });

  it("should default to an empty object when neither option is provided", () => {
    const plugin = new MinimizerPlugin();

    expect(plugin.options.minimizer.options).toEqual({});
  });
});
