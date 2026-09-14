---
"minimizer-webpack-plugin": minor
---

let a minimizer or generator say which `processAssets` stage it runs in and what the asset it wrote says about itself, through a `getStage` and a `getAssetInfo` on the function — the way it declares everything else — and ship `MinimizerPlugin.compress`, which takes the `algorithm` to run and the `compressionOptions` to run it with, marks what it wrote `compressed` rather than `minimized`, and goes to `minify` to compress an asset in place or to `generate` to write the compressed file beside it
