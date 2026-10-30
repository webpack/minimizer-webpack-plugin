---
"minimizer-webpack-plugin": patch
---

Compose source maps and locate minifier errors with webpack's own `webpack-sources` (`compiler.webpack.sources`) instead of `@jridgewell/trace-mapping`, which now map each token to its exact original column. The plugin no longer has a source map dependency of its own; with a webpack whose `webpack-sources` predates 3.7.0, minifier errors are reported at their minified position.
