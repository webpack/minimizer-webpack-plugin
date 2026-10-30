import path from "path";

import {
  TraceMap,
  decodedMappings,
  eachMapping,
} from "@jridgewell/trace-mapping";

import MinimizerPlugin from "../src/index";

import { compile, getCompiler, getErrors, readAsset } from "./helpers";

// What the snapshots elsewhere can't say: a map can match its snapshot and
// still point every token at the wrong column. Here each mapping is checked
// against the original source it names, through one or more minimizers.

/**
 * @param {EXPECTED_ANY} minify minify option
 * @param {EXPECTED_ANY=} minimizerOptions minimizer options
 * @param {boolean=} parallel whether to minify in workers
 * @returns {Promise<{ map: EXPECTED_ANY, errors: EXPECTED_ANY[] }>} the emitted map
 */
async function build(minify, minimizerOptions, parallel = false) {
  const compiler = getCompiler({
    devtool: "source-map",
    entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
  });

  new MinimizerPlugin({ minify, minimizerOptions, parallel }).apply(compiler);

  const stats = await compile(compiler);

  return {
    map: JSON.parse(readAsset("main.js.map", compiler, stats)),
    errors: getErrors(stats),
  };
}

/**
 * Lists every named mapping whose name is not what the original source holds
 * at the position it points to.
 * @param {EXPECTED_ANY} rawMap source map
 * @returns {{ named: number, wrong: string[] }} how many named mappings, and the wrong ones
 */
function checkNames(rawMap) {
  const map = new TraceMap(rawMap);
  /** @type {string[]} */
  const wrong = [];
  let named = 0;

  eachMapping(map, (mapping) => {
    if (mapping.source === null || mapping.name === null) {
      return;
    }

    named++;

    const content =
      rawMap.sourcesContent[map.resolvedSources.indexOf(mapping.source)];
    const line = content.split("\n")[mapping.originalLine - 1] || "";
    const found = line.slice(
      mapping.originalColumn,
      mapping.originalColumn + mapping.name.length,
    );

    if (found !== mapping.name) {
      wrong.push(
        `${mapping.name} -> ${mapping.source}:${mapping.originalLine}:${mapping.originalColumn} reads "${found}"`,
      );
    }
  });

  return { named, wrong };
}

describe("source maps through a chain of minimizers", () => {
  it.each([
    ["one `terserMinify`", MinimizerPlugin.terserMinify, undefined],
    [
      "two `terserMinify`",
      [MinimizerPlugin.terserMinify, MinimizerPlugin.terserMinify],
      [{ mangle: false }, { mangle: true }],
    ],
    [
      "three `terserMinify`",
      [
        MinimizerPlugin.terserMinify,
        MinimizerPlugin.terserMinify,
        MinimizerPlugin.terserMinify,
      ],
      [{ mangle: false }, { mangle: false }, { mangle: true }],
    ],
    [
      "`terserMinify` then `uglifyJsMinify`",
      [MinimizerPlugin.terserMinify, MinimizerPlugin.uglifyJsMinify],
      [{ mangle: false }, { mangle: true }],
    ],
  ])(
    "should map every name back to the original source with %s",
    async (_name, minify, minimizerOptions) => {
      const { map, errors } = await build(minify, minimizerOptions);
      const { named, wrong } = checkNames(map);

      expect(errors).toEqual([]);
      // The asset itself is an intermediate step, never an original source.
      expect(map.sources).not.toContain("main.js");
      expect(named).toBeGreaterThan(0);
      expect(wrong).toEqual([]);
    },
  );

  it.each([
    ["first", (decoded) => [decoded, MinimizerPlugin.terserMinify]],
    ["last", (decoded) => [MinimizerPlugin.terserMinify, decoded]],
  ])(
    "should map every name back when the %s minimizer returns decoded mappings",
    async (_name, chain) => {
      // A custom minimizer may answer with `mappings` as arrays of segments.
      /** @type {EXPECTED_ANY} */
      const decoded = async (...args) => {
        const result = await MinimizerPlugin.terserMinify(...args);
        const map =
          typeof result.map === "string" ? JSON.parse(result.map) : result.map;

        return {
          ...result,
          map: { ...map, mappings: decodedMappings(new TraceMap(map)) },
        };
      };
      const { map, errors } = await build(chain(decoded), [
        { mangle: false },
        { mangle: true },
      ]);
      const { named, wrong } = checkNames(map);

      expect(errors).toEqual([]);
      expect(map.sources).not.toContain("main.js");
      expect(named).toBeGreaterThan(0);
      expect(wrong).toEqual([]);
    },
  );

  it("should map the same in workers as in the main thread", async () => {
    const minify = [MinimizerPlugin.terserMinify, MinimizerPlugin.terserMinify];
    const minimizerOptions = [{ mangle: false }, { mangle: true }];
    const inline = await build(minify, minimizerOptions, false);
    const workers = await build(minify, minimizerOptions, true);

    expect(workers.errors).toEqual([]);
    expect(checkNames(workers.map).wrong).toEqual([]);
    expect(workers.map).toEqual(inline.map);
  });
});
