/**
 * Stands in for a CSS minifier that says one thing, next to a second module
 * saying another: what each returns is how a cache mix-up shows.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @returns {{ code: string }} what it made of the stylesheet
 */
function cssSaysOne() {
  return { code: ".a{--said:one}" };
}

cssSaysOne.getTypes = () => ["css"];
cssSaysOne.filter = (asset) => /\.css(\?.*)?$/i.test(asset);

module.exports = cssSaysOne;
