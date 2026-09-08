/**
 * @param {import("../../src/index.js").Input} input input
 * @returns {Promise<import("../../src/index.js").MinimizedResult>} result
 */
module.exports = async function minifyDefaultExport(input) {
  const [[name, code]] = Object.entries(input);

  return { code: String(code).replace(/\s+/g, " ").trim(), filename: name };
};
