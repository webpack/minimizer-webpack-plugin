import { getEcmaVersion } from "../src/utils";

describe("getEcmaVersion", () => {
  it("returns 5 when no ES feature flags are set", () => {
    expect(getEcmaVersion({})).toBe(5);
    expect(getEcmaVersion({ document: true })).toBe(5);
    expect(getEcmaVersion({ nodePrefixForCoreModules: true })).toBe(5);
  });

  it("returns 2015 for ES2015 feature flags", () => {
    expect(getEcmaVersion({ arrowFunction: true })).toBe(2015);
    expect(getEcmaVersion({ const: true })).toBe(2015);
    expect(getEcmaVersion({ destructuring: true })).toBe(2015);
    expect(getEcmaVersion({ forOf: true })).toBe(2015);
    expect(getEcmaVersion({ methodShorthand: true })).toBe(2015);
    expect(getEcmaVersion({ module: true })).toBe(2015);
    expect(getEcmaVersion({ templateLiteral: true })).toBe(2015);
  });

  it("returns 2017 for ES2017 feature flags", () => {
    expect(getEcmaVersion({ asyncFunction: true })).toBe(2017);
  });

  it("returns 2020 for ES2020 feature flags", () => {
    expect(getEcmaVersion({ bigIntLiteral: true })).toBe(2020);
    expect(getEcmaVersion({ dynamicImport: true })).toBe(2020);
    expect(getEcmaVersion({ dynamicImportInWorker: true })).toBe(2020);
    expect(getEcmaVersion({ globalThis: true })).toBe(2020);
    expect(getEcmaVersion({ optionalChaining: true })).toBe(2020);
  });

  it("returns the highest matching version when several flags are set", () => {
    expect(
      getEcmaVersion({
        arrowFunction: true,
        asyncFunction: true,
        bigIntLiteral: true,
      }),
    ).toBe(2020);

    expect(
      getEcmaVersion({
        arrowFunction: true,
        asyncFunction: true,
      }),
    ).toBe(2017);

    expect(
      getEcmaVersion({
        arrowFunction: true,
        const: true,
      }),
    ).toBe(2015);
  });

  it("ignores non-ES feature flags", () => {
    expect(
      getEcmaVersion({
        document: true,
        nodePrefixForCoreModules: true,
        arrowFunction: true,
      }),
    ).toBe(2015);
  });
});
