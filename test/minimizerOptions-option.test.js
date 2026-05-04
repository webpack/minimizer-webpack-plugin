import path from "path";

import TerserPlugin from "../src/index";

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

    new TerserPlugin({
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
    const pluginA = new TerserPlugin({
      minimizerOptions: { mangle: false },
    });
    const pluginB = new TerserPlugin({
      terserOptions: { mangle: false },
    });

    expect(pluginA.options.minimizer.options).toEqual(
      pluginB.options.minimizer.options,
    );
  });

  it("should throw when both `minimizerOptions` and `terserOptions` are provided", () => {
    expect(
      () =>
        new TerserPlugin({
          minimizerOptions: { mangle: false },
          terserOptions: { mangle: false },
        }),
    ).toThrow(/can't be used together/);
  });

  it("should default to an empty object when neither option is provided", () => {
    const plugin = new TerserPlugin();

    expect(plugin.options.minimizer.options).toEqual({});
  });
});
