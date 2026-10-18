---
"minimizer-webpack-plugin": patch
---

perf: validate options with a check precompiled by `schema-utils precompile`, so valid options no longer load `ajv` and compile the schema, about 200ms off every production webpack start
