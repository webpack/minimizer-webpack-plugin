import path from "path";

import MinimizerPlugin from "../src/index";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

describe("include option", () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: {
        included1: path.resolve(__dirname, "./fixtures/included1.js"),
        included2: path.resolve(__dirname, "./fixtures/included2.js"),
        entry: path.resolve(__dirname, "./fixtures/entry.js"),
      },
    });
  });

  it("should match snapshot for a single RegExp value", async () => {
    new MinimizerPlugin({
      include: /included1/i,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot for a single String value", async () => {
    new MinimizerPlugin({
      include: "included1",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot for multiple RegExp values", async () => {
    new MinimizerPlugin({
      include: [/included1/i, /included2/i],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot for multiple String values", async () => {
    new MinimizerPlugin({
      include: ["included1", "included2"],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });
});
