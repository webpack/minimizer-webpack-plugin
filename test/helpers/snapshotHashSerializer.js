// Webpack bakes content/chunk/full hashes into asset filenames and into the
// runtime chunk-loading code. Those digests are not stable across environments
// — for example, this plugin folds the minimizer (terser) version into the
// chunk hash for cache busting, so a different installed terser changes every
// hash even when the emitted code is byte-for-byte identical. Normalising the
// digests keeps the snapshots focused on the output that actually matters.

const HASH = /\b[0-9a-f]{20,}\b/g;

const hasHash = (string) => /\b[0-9a-f]{20,}\b/.test(string);

// Map each distinct digest to a stable, unique token (by order of first
// appearance, which is deterministic for a given snapshot). Distinct hashes
// therefore never collapse into the same token, so using the result as an
// object key can't silently drop asset entries.
const makeStripper = () => {
  const tokens = new Map();

  return (string) =>
    string.replace(HASH, (hash) => {
      let token = tokens.get(hash);

      if (token === undefined) {
        token = `__hash${tokens.size}__`;
        tokens.set(hash, token);
      }

      return token;
    });
};

const isAssetMap = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return (
    keys.length > 0 &&
    keys.every((key) => typeof value[key] === "string") &&
    keys.some((key) => hasHash(key) || hasHash(value[key]))
  );
};

module.exports = {
  test(value) {
    return typeof value === "string" ? hasHash(value) : isAssetMap(value);
  },
  print(value, printer) {
    const strip = makeStripper();

    if (typeof value === "string") {
      return printer(strip(value));
    }

    const normalized = {};

    for (const key of Object.keys(value)) {
      normalized[strip(key)] = strip(value[key]);
    }

    return printer(normalized);
  },
};
