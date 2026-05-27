// The bundled CSS minimizers (`cssnano@7`, `@swc/css`, `lightningcss`,
// `esbuild@0.27`) require modern Node and don't reliably install on the
// Windows agents. Skip the dedicated CSS test file outright on rows that
// can't run them so we don't end up with stale or missing snapshots.
const NODE_MAJOR = Number(process.versions.node.split(".")[0]);
const IS_WINDOWS = process.platform === "win32";
const RUN_CSS_TESTS = NODE_MAJOR >= 18 && !IS_WINDOWS;

module.exports = {
  testEnvironment: "node",
  // The default 5s timeout is too tight for slower CI runners (especially
  // older Node on macOS), where webpack + multiple minimizers per asset
  // routinely take longer than that.
  testTimeout: 60000,
  coveragePathIgnorePatterns: ["src/serialize-javascript.js"],
  snapshotSerializers: ["<rootDir>/test/helpers/snapshotHashSerializer.js"],
  testPathIgnorePatterns: RUN_CSS_TESTS
    ? []
    : ["/test/css-minify-option\\.test\\.js$"],
};
