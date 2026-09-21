/**
 * Stands in for a CSS minifier that says another thing, next to a first module
 * saying one: what each returns is how a cache mix-up shows.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @returns {{ code: string }} what it made of the stylesheet
 */
function cssSaysTwo() {
  return { code: ".a{--said:two}" };
}

cssSaysTwo.getTypes = () => ["css"];
cssSaysTwo.filter = (asset) => /\.css(\?.*)?$/i.test(asset);

module.exports = cssSaysTwo;
