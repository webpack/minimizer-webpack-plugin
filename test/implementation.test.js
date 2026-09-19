import path from "path";

import {
  canMinifyByPath,
  getImplementationModuleRef,
  loadImplementation,
} from "../src/implementation.js";
import { terserMinify } from "../src/utils.js";

describe("getImplementationModuleRef", () => {
  it("should accept a module path string", () => {
    expect(getImplementationModuleRef("/abs/utils.js")).toEqual({
      path: "/abs/utils.js",
    });
  });

  it("should accept { path } without export", () => {
    expect(getImplementationModuleRef({ path: "/abs/utils.js" })).toEqual({
      path: "/abs/utils.js",
    });
  });

  it("should accept { path, export }", () => {
    expect(
      getImplementationModuleRef({
        path: "/abs/utils.js",
        export: "terserMinify",
      }),
    ).toEqual({ path: "/abs/utils.js", export: "terserMinify" });
  });

  it("should ignore an empty export name", () => {
    expect(
      getImplementationModuleRef({ path: "/abs/utils.js", export: "" }),
    ).toEqual({ path: "/abs/utils.js" });
  });

  it("should return undefined for functions and other values", () => {
    expect(getImplementationModuleRef(terserMinify)).toBeUndefined();
    expect(getImplementationModuleRef(null)).toBeUndefined();
    expect(
      getImplementationModuleRef({ export: "terserMinify" }),
    ).toBeUndefined();
  });
});

describe("loadImplementation", () => {
  it("should return a function implementation as-is", () => {
    expect(loadImplementation(terserMinify)).toBe(terserMinify);
  });

  it("should load a named export from { path, export }", () => {
    expect(
      loadImplementation({
        path: require.resolve("../src/utils.js"),
        export: "terserMinify",
      }),
    ).toBe(terserMinify);
  });

  it("should load module.exports when it is the function", () => {
    const fixture = path.resolve(
      __dirname,
      "./fixtures/minify-default-export.js",
    );

    expect(loadImplementation(fixture)).toBe(require(fixture));
  });

  it("should load the default export when the module is not a function", () => {
    const fixture = path.resolve(
      __dirname,
      "./fixtures/minify-default-property.js",
    );

    expect(loadImplementation(fixture)).toBe(require(fixture).default);
  });

  it("should throw for an invalid implementation value", () => {
    expect(() => loadImplementation(null)).toThrow(
      /expected a function, module path string, or \{ path, export \}/,
    );
  });

  it("should throw when a named export is not a function", () => {
    expect(() =>
      loadImplementation({
        path: require.resolve("../src/utils.js"),
        export: "CLASSIC_SCRIPT",
      }),
    ).toThrow(/Minimizer export "CLASSIC_SCRIPT" is not a function/);
  });

  it("should throw when the module does not export a function", () => {
    expect(() =>
      loadImplementation(require.resolve("../src/utils.js")),
    ).toThrow(/Minimizer module does not export a function/);
  });
});

describe("canMinifyByPath", () => {
  const utilsPath = require.resolve("../src/utils.js");
  const pathImpl = { path: utilsPath, export: "terserMinify" };

  it("should allow a single path implementation", () => {
    expect(
      canMinifyByPath({
        minimizer: { implementation: pathImpl },
      }),
    ).toBe(true);
  });

  it("should allow a string path implementation", () => {
    expect(
      canMinifyByPath({
        minimizer: {
          implementation: path.resolve(
            __dirname,
            "./fixtures/minify-default-export.js",
          ),
        },
      }),
    ).toBe(true);
  });

  it("should reject an inline function implementation", () => {
    expect(
      canMinifyByPath({
        minimizer: { implementation: terserMinify },
      }),
    ).toBe(false);
  });

  it("should allow embedded when every implementation is a path", () => {
    expect(
      canMinifyByPath({
        minimizer: { implementation: [pathImpl] },
        embedded: {
          implementation: pathImpl,
          options: {},
          claims: [],
          offers: [],
          at: [0],
        },
      }),
    ).toBe(true);
  });

  it("should reject embedded when any implementation is a function", () => {
    expect(
      canMinifyByPath({
        minimizer: { implementation: [pathImpl] },
        embedded: {
          implementation: [pathImpl, terserMinify],
          options: [{}, {}],
          claims: [[], []],
          offers: [[], []],
          at: [0],
        },
      }),
    ).toBe(false);
  });
});
