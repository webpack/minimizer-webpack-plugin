---
"minimizer-webpack-plugin": patch
---

Compose source maps and locate minifier errors with `webpack-sources` instead of `@jridgewell/trace-mapping`, which now map each token to its exact original column.
