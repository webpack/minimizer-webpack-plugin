const WEBPACK_HASH_PATTERN = /\b[a-f0-9]{20,64}\b/giu;

/**
 * Snapshot tests should assert build structure, not unstable webpack digests.
 * CI runs pull request merge commits and older Node.js jobs resolve a slightly
 * different dependency tree, so raw hash values are expected to drift.
 * @param {string} value value
 * @returns {string} value with normalized webpack hashes
 */
export default function normalizeBuildOutput(value) {
  return value.replace(WEBPACK_HASH_PATTERN, "[hash]");
}
