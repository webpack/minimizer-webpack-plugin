---
"minimizer-webpack-plugin": patch
---

Run async native minimizers (`swcMinify`, `esbuildMinify`, `swcMinifyHtml`, `swcMinifyHtmlFragment`, `esbuildMinifyCss`, `swcMinifyCss`) in the webpack process, `parallel` at once, instead of on threads or `jest-worker` child processes: faster and less memory. They declare the new `prefersMainThread()`; synchronous minimizers keep the pool.
