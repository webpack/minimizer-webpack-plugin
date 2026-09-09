import webpack from "webpack";

export default class ExistingCommentsFile {
  constructor({ asBuffer = false } = {}) {
    this.asBuffer = asBuffer;
  }

  apply(compiler) {
    const plugin = { name: this.constructor.name };

    compiler.hooks.thisCompilation.tap(plugin, (compilation) => {
      compilation.hooks.additionalAssets.tap(plugin, () => {
        const contents = "// Existing Comment";

        compilation.assets["licenses.txt"] = new webpack.sources.RawSource(
          this.asBuffer ? Buffer.from(contents) : contents,
        );
      });
    });
  }
}
