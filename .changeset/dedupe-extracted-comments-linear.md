---
"minimizer-webpack-plugin": patch
---

fix quadratic slowdown when deduplicating extracted comments (GHSA-8cjx-vvr8-p635); membership is now tracked with a `Set` so build time scales linearly with the number of distinct preserved comments
