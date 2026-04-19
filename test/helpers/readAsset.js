import path from "path";

/**
 * @param {string} value value
 * @returns {string} value without cwd
 */
function removeCWD(value) {
  const isWin = process.platform === "win32";
  let normalizedValue = value;
  let cwd = process.cwd();

  if (isWin) {
    normalizedValue = normalizedValue.replace(/\\/g, "/");
    cwd = cwd.replace(/\\/g, "/");
  }

  const cwdPrefix = `${cwd}/`;

  return normalizedValue.split(cwdPrefix).join("");
}

/**
 * @param {string} asset asset name
 * @param {import("webpack").Compiler} compiler compiler
 * @param {import("webpack").Stats} stats stats
 * @returns {string} asset code
 */
export default (asset, compiler, stats) => {
  const usedFs = compiler.outputFileSystem;
  const outputPath = stats.compilation.outputOptions.path;

  let data = "";
  let targetFile = asset;

  const queryStringIdx = targetFile.indexOf("?");

  if (queryStringIdx >= 0) {
    targetFile = targetFile.slice(0, queryStringIdx);
  }

  try {
    data = usedFs.readFileSync(path.join(outputPath, targetFile)).toString();
  } catch (error) {
    data = removeCWD(error.toString());
  }

  return data;
};
