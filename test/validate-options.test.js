import TerserPlugin from "../src";

describe("validation", () => {
  it("validate", () => {
    /* eslint-disable no-new */
    expect(() => {
      new TerserPlugin({ test: /foo/ });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ test: "foo" });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ test: [/foo/] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ test: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ test: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ test: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ test: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ test: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ include: /foo/ });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ include: "foo" });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ include: [/foo/] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ include: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ include: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ include: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ include: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ include: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ exclude: /foo/ });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ exclude: "foo" });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ exclude: [/foo/] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ exclude: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ exclude: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ exclude: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ exclude: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ exclude: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ parallel: true });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ parallel: false });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ parallel: 2 });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ parallel: "2" });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ parallel: {} });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ minify() {} });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ minify: [() => ({ code: "" })] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        minify: [() => ({ code: "" }), () => ({ code: "" })],
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ minify: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ minify: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ terserOptions: {} });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ terserOptions: [{}] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ terserOptions: [{}, {}] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ terserOptions: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ terserOptions: null });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({
        terserOptions: {
          ecma: undefined,
          parse: {},
          compress: {},
          mangle: true,
          module: false,
          output: null,
          toplevel: false,
          nameCache: null,
          ie8: false,
          keep_classnames: false,
          keep_fnames: false,
          safari10: false,
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ terserOptions: { emca: 5 } });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ extractComments: true });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ extractComments: false });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ extractComments: "comment" });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ extractComments: /comment/ });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ extractComments() {} });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          condition: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          condition: "comment",
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          condition: /comment/,
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          condition() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          condition: {},
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          filename: "test.js",
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          filename() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          filename: true,
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          banner: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          banner: "banner",
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          banner() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({
        extractComments: {
          banner: /test/,
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ extractComments: { unknown: true } });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ unknown: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ minimizerOptions: {} });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ minimizerOptions: [{}] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ minimizerOptions: [{}, {}] });
    }).not.toThrow();

    expect(() => {
      new TerserPlugin({ minimizerOptions: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({ minimizerOptions: null });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new TerserPlugin({
        minimizerOptions: { ecma: 5 },
        terserOptions: { ecma: 5 },
      });
    }).toThrowErrorMatchingSnapshot();
  });
});
/* eslint-enable no-new */
