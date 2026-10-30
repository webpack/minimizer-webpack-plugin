import { sources as webpackSources } from "webpack";

import { getSourceMapUtil, getSources } from "../src/sources";

describe("getSources", () => {
  it("should read the installed webpack's copy by default", () => {
    expect(getSources()).toBe(webpackSources);
  });

  it("should take the copy it is given", () => {
    const sources = /** @type {EXPECTED_ANY} */ ({});

    expect(getSources(sources)).toBe(sources);
  });
});

describe("getSourceMapUtil", () => {
  it("should take `util.sourceMap` from webpack-sources 3.7.0 and later", () => {
    const sourceMap = { originalPositionFor: () => null };

    expect(
      getSourceMapUtil(/** @type {EXPECTED_ANY} */ ({ util: { sourceMap } })),
    ).toBe(sourceMap);
  });

  it("should give nothing for an older webpack-sources", () => {
    // 3.x before 3.7.0 has `util` without `util.sourceMap`; 2.x has no `util`.
    expect(
      getSourceMapUtil(/** @type {EXPECTED_ANY} */ ({ util: {} })),
    ).toBeUndefined();
    expect(getSourceMapUtil(/** @type {EXPECTED_ANY} */ ({}))).toBeUndefined();
  });
});
