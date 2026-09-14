---
"minimizer-webpack-plugin": minor
---

add a `stage` option choosing the `processAssets` stage the minimizers run in, `minify: false` for a plugin that only generates, an `asset` generator's own `stage`, `threshold`, `minRatio`, `relatedName` and `assetInfo`, a `filename` that may be a function or name the asset it read, and `zlibCompress`, so compressing what minification produced is the same plugin over one pass of filtering and one cache. An `asset` generator reporting an error now writes no file, where it previously wrote whatever the failed generator answered with; it reads an asset's own bytes rather than its `source()`, which lost every byte above 0x7f where a plugin had put text beside binary; and what it writes is cached as a `Source`, so a rebuild that restores one re-emits nothing
