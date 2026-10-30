import { sources as webpackSources } from "webpack";
import pluginSources from "webpack-sources";

import { getSources } from "../src/sources";

describe("getSources", () => {
  it("should take webpack's own copy when it carries `util.sourceMap`", () => {
    const withUtil = { util: { sourceMap: {} } };

    expect(getSources(/** @type {EXPECTED_ANY} */ (withUtil))).toBe(withUtil);
  });

  it("should fall back to the plugin's copy for an older webpack", () => {
    // A webpack-sources before 3.7.0 has `util`, but no `util.sourceMap`.
    expect(getSources(/** @type {EXPECTED_ANY} */ ({ util: {} }))).toBe(
      pluginSources,
    );
    expect(getSources(/** @type {EXPECTED_ANY} */ ({}))).toBe(pluginSources);
  });

  it("should read the installed webpack's copy by default", () => {
    expect(getSources()).toBe(
      typeof (/** @type {EXPECTED_ANY} */ (webpackSources).util.sourceMap) ===
        "object"
        ? webpackSources
        : pluginSources,
    );
  });
});
