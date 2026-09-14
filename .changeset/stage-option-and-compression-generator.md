---
"minimizer-webpack-plugin": minor
---

add a `stage` option choosing the `processAssets` stage the minimizers run in, a `label` the reported errors and warnings name, `minify: false` for a plugin that only generates, an `asset` generator's own `stage`, `threshold`, `minRatio`, `relatedName` and `assetInfo`, a `filename` that may be a function or name the asset it read, and `zlibCompress`, so compressing what minification produced is the same plugin over one pass of filtering and one cache; an `asset` generator reporting an error now writes no file, where it previously wrote whatever the failed generator answered with
