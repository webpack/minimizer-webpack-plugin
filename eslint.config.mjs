import { defineConfig } from "eslint/config";
import configs from "eslint-config-webpack/configs.js";

export default defineConfig([
  {
    ignores: ["./src/serialize-javascript.js"],
    extends: [configs["recommended-dirty"]],
  },
]);
