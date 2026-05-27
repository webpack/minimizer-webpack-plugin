// Webpack bakes content/chunk/full hashes into asset filenames and into the
// runtime chunk-loading code. Those digests are not stable across environments
// — for example, this plugin folds the minimizer (terser) version into the
// chunk hash for cache busting, so a different installed terser changes every
// hash even when the emitted code is byte-for-byte identical. Normalising the
// digests keeps the snapshots focused on the output that actually matters.

const HASH = /\b[0-9a-f]{20,}\b/g;
const PLACEHOLDER = "x".repeat(20);

const hasHash = (string) => /\b[0-9a-f]{20,}\b/.test(string);
const strip = (string) => string.replace(HASH, PLACEHOLDER);

const isAssetMap = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0 &&
  Object.keys(value).every((key) => typeof value[key] === "string") &&
  Object.keys(value).some((key) => hasHash(key) || hasHash(value[key]));

module.exports = {
  test(value) {
    return typeof value === "string" ? hasHash(value) : isAssetMap(value);
  },
  serialize(value, config, indentation, depth, refs, printer) {
    if (typeof value === "string") {
      return printer(strip(value), config, indentation, depth, refs);
    }

    const normalized = {};

    for (const key of Object.keys(value)) {
      normalized[strip(key)] = strip(value[key]);
    }

    return printer(normalized, config, indentation, depth, refs);
  },
};
