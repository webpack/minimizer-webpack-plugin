---
"minimizer-webpack-plugin": minor
---

terser-webpack-plugin has been renamed to minimizer-webpack-plugin, merging other minimizers from css-minimizer-webpack-plugin and html-minimizer-webpack-plugin. We will continue to publish new releases under the old name, but we recommend switching to the new package - minimizer-webpack-plugin. It is now a single plugin for minification. We also added the ability to specify different minifier types using only one plugin instance, which will improve performance.
