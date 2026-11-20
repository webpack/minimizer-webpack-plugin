---
"minimizer-webpack-plugin": patch
---

Minify the precompiled options check, so it loads faster, and run it before `schema-utils` on webpack versions without `compiler.validate`, so valid options load neither `schema-utils` nor the schema there either.
