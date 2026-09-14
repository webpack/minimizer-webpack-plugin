---
"minimizer-webpack-plugin": minor
---

let a minimizer or generator say which `processAssets` stage it runs in, through a `getStage` on the function — the way it declares everything else about itself — and ship `MinimizerPlugin.compress`, which takes the `algorithm` to run and the `compressionOptions` to run it with, and goes to `minify` to compress an asset in place or to `generate` to write the compressed file beside it
