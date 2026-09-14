---
"minimizer-webpack-plugin": minor
---

add a `stage` option choosing the `processAssets` stage the minimizers run in, give an `asset` generator its own `stage`, `threshold`, `minRatio`, `relatedName` and `assetInfo`, and ship `zlibCompress`, so compressing what minification produced is the same plugin over one pass of filtering and one cache
