import path from "path";

import TerserPlugin from "../src";

import {
  EmitNewAsset,
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readAsset,
  readsAssets,
} from "./helpers";

// jest.fn() can't be used directly because schema-utils calls
// `value instanceof Function` on each minify entry, and the mock function
// is constructed in a different VM context than the schema-utils Function
// global, so the instanceof check fails. Wrap a plain function instead and
// track calls manually.
function makeMinify(impl) {
  /**
   * @param {...EXPECTED_ANY} args minify arguments
   * @returns {EXPECTED_ANY} result
   */
  function fn(...args) {
    fn.calls.push(args);
    return impl(...args);
  }
  fn.calls = [];
  return fn;
}

describe("minimizer filter", () => {
  it("skips assets when the only minimizer's filter rejects them", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    const minify = makeMinify(() => ({ code: "/* minified */" }));

    minify.filter = () => false;

    new TerserPlugin({
      parallel: false,
      minify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(minify.calls).toHaveLength(0);
    expect(readAsset("main.js", compiler, stats)).not.toContain(
      "/* minified */",
    );
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("dispatches each asset to the minimizer whose filter accepts it", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    new EmitNewAsset({ name: "extra.css" }).apply(compiler);

    const jsMinify = makeMinify(() => ({ code: "var a=1;/*JS*/" }));

    jsMinify.filter = (name) => /\.[cm]?js(\?.*)?$/i.test(name);

    const cssMinify = makeMinify(() => ({ code: "/*CSS*/a{}" }));

    cssMinify.filter = (name) => /\.css(\?.*)?$/i.test(name);

    new TerserPlugin({
      parallel: false,
      test: /\.(?:[cm]?js|css)(\?.*)?$/i,
      minify: [jsMinify, cssMinify],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(jsMinify.calls).toHaveLength(1);
    expect(cssMinify.calls).toHaveLength(1);
    expect(Object.keys(jsMinify.calls[0][0])[0]).toBe("main.js");
    expect(Object.keys(cssMinify.calls[0][0])[0]).toBe("extra.css");

    const assets = readsAssets(compiler, stats);

    expect(assets["main.js"]).toContain("/*JS*/");
    expect(assets["extra.css"]).toContain("/*CSS*/");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("treats a filter returning undefined as accept", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    const minify = makeMinify(() => ({ code: "/*UNDEF-FILTER*/" }));

    minify.filter = () => undefined;

    new TerserPlugin({
      parallel: false,
      minify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(minify.calls).toHaveLength(1);
    expect(readAsset("main.js", compiler, stats)).toContain("/*UNDEF-FILTER*/");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("skips an asset when every minimizer in the array rejects it", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    new EmitNewAsset({ name: "stranger.txt" }).apply(compiler);

    const jsMinify = makeMinify(() => ({ code: "/*JS*/" }));

    jsMinify.filter = (name) => /\.[cm]?js(\?.*)?$/i.test(name);

    const cssMinify = makeMinify(() => ({ code: "/*CSS*/" }));

    cssMinify.filter = (name) => /\.css(\?.*)?$/i.test(name);

    new TerserPlugin({
      parallel: false,
      // Widen `test` so the .txt asset reaches the dispatcher and we can
      // verify that no minimizer in the array claims it.
      test: /.*/,
      minify: [jsMinify, cssMinify],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(jsMinify.calls).toHaveLength(1);
    expect(cssMinify.calls).toHaveLength(0);

    const txt = readAsset("stranger.txt", compiler, stats);

    expect(txt).not.toContain("/*JS*/");
    expect(txt).not.toContain("/*CSS*/");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("keeps the chain semantic when multiple minimizers in the array accept the same asset", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    const firstMinify = makeMinify((input) => {
      const [[, code]] = Object.entries(input);

      return { code: `${code}/*FIRST*/` };
    });

    firstMinify.filter = (name) => /\.[cm]?js(\?.*)?$/i.test(name);

    const secondMinify = makeMinify((input) => {
      const [[, code]] = Object.entries(input);

      return { code: `${code}/*SECOND*/` };
    });

    secondMinify.filter = (name) => /\.[cm]?js(\?.*)?$/i.test(name);

    new TerserPlugin({
      parallel: false,
      minify: [firstMinify, secondMinify],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(firstMinify.calls).toHaveLength(1);
    expect(secondMinify.calls).toHaveLength(1);

    const [[secondInput]] = secondMinify.calls;
    const [secondCode] = Object.values(secondInput);

    expect(secondCode).toContain("/*FIRST*/");

    const out = readAsset("main.js", compiler, stats);

    expect(out).toContain("/*FIRST*/");
    expect(out).toContain("/*SECOND*/");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("dispatches across asset types when `test` is widened", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    new EmitNewAsset({ name: "extra.css" }).apply(compiler);

    const jsMinify = makeMinify(() => ({ code: "/*JS*/" }));

    jsMinify.filter = (name) => /\.[cm]?js(\?.*)?$/i.test(name);

    const cssMinify = makeMinify(() => ({ code: "/*CSS*/" }));

    cssMinify.filter = (name) => /\.css(\?.*)?$/i.test(name);

    new TerserPlugin({
      parallel: false,
      // `test` still defaults to JS only; widen it (or set it to a regex
      // that catches every asset) so the dispatcher gets to see CSS too.
      test: /\.(?:[cm]?js|css)(\?.*)?$/i,
      minify: [jsMinify, cssMinify],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(jsMinify.calls).toHaveLength(1);
    expect(cssMinify.calls).toHaveLength(1);
    expect(readAsset("extra.css", compiler, stats)).toContain("/*CSS*/");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("keeps the JS-only `test` default when a single minimizer is provided", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    new EmitNewAsset({ name: "extra.css" }).apply(compiler);

    const minify = makeMinify(() => ({ code: "/*ONLY*/" }));

    new TerserPlugin({
      parallel: false,
      minify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(minify.calls).toHaveLength(1);
    expect(Object.keys(minify.calls[0][0])[0]).toBe("main.js");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("pairs the per-asset implementation subset with the matching options entries", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    new EmitNewAsset({ name: "extra.css" }).apply(compiler);

    const jsMinify = makeMinify(() => ({ code: "/*JS*/" }));

    jsMinify.filter = (name) => /\.[cm]?js(\?.*)?$/i.test(name);

    const cssMinify = makeMinify(() => ({ code: "/*CSS*/" }));

    cssMinify.filter = (name) => /\.css(\?.*)?$/i.test(name);

    new TerserPlugin({
      parallel: false,
      test: /\.(?:[cm]?js|css)(\?.*)?$/i,
      minify: [jsMinify, cssMinify],
      minimizerOptions: [{ flavor: "js" }, { flavor: "css" }],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(jsMinify.calls).toHaveLength(1);
    expect(cssMinify.calls).toHaveLength(1);

    const [[, , jsOptions]] = jsMinify.calls;

    expect(jsOptions.flavor).toBe("js");

    const [[, , cssOptions]] = cssMinify.calls;

    expect(cssOptions.flavor).toBe("css");
    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });
});
