// eslint-disable-next-line n/no-unsupported-features/node-builtins
const fs = require("fs").promises;
const path = require("path");

/* eslint-disable no-console */

const randomBytesFallback = `
var g = typeof globalThis !== 'undefined' ? globalThis : global;
var crypto = g.crypto || {};

if (typeof crypto.getRandomValues !== 'function') {
  var nodeCrypto = require('crypto');

  crypto.getRandomValues = function(typedArray) {
    var bytes = nodeCrypto.randomBytes(typedArray.byteLength);

    new Uint8Array(
      typedArray.buffer,
      typedArray.byteOffset,
      typedArray.byteLength
    ).set(bytes);

    return typedArray;
  };
}
`;

/**
 * @param {string} src source path
 * @param {string} dest destination path
 * @returns {Promise<void>}
 */
async function copyIfChanged(src, dest) {
  let srcContent;

  try {
    srcContent = await fs.readFile(src, "utf8");
    srcContent = `// @ts-nocheck\n${randomBytesFallback}${srcContent}`;
  } catch (_err) {
    srcContent = null;
  }

  let destContent;
  try {
    destContent = await fs.readFile(dest, "utf8");
  } catch (_err) {
    destContent = null;
  }

  if (
    srcContent === null ||
    destContent === null ||
    srcContent !== destContent
  ) {
    if (process.argv.includes("--check")) {
      throw new Error(`Content mismatch between ${src} and ${dest}`);
    }

    await fs.writeFile(dest, srcContent);
    console.log("File copied: content changed.");
  } else {
    console.log("No copying required: the content is identical.");
  }
}

const src = path.resolve(
  __dirname,
  "../node_modules/serialize-javascript/index.js",
);
const dest = path.resolve(__dirname, "../src/serialize-javascript.js");

copyIfChanged(src, dest);
