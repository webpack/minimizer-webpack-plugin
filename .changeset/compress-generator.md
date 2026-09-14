---
"minimizer-webpack-plugin": minor
---

let a minimizer or generator say which `processAssets` stage it runs in and what name its work goes under in an asset's info, through a `getStage` and a `getAssetFlag` on the function — the way it declares everything else — and ship `MinimizerPlugin.compress`, which takes the `algorithm` to run and the `compressionOptions` to run it with, works under `compressed` rather than `minimized` or `generated`, and goes to `minify` to compress an asset in place or to `generate` to write the compressed file beside it
