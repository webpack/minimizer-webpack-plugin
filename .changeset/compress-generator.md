---
"minimizer-webpack-plugin": minor
---

add a `stage` option choosing the `processAssets` stage the minimizers run in, give an `asset` generator a `stage` of its own, and ship `MinimizerPlugin.compress` — which takes the `algorithm` to run and the `compressionOptions` to run it with
