---
"minimizer-webpack-plugin": patch
---

Run minimizers without worker thread support (`swcMinify`, `esbuildMinify`, `minifyHtmlNode`, `swcMinifyHtml`, `jsonMinify`) in the webpack process, `parallel` at once, instead of on threads or `jest-worker` child processes: faster and less memory.
