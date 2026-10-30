/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */
/** @typedef {import("./index.js").CustomOptions} CustomOptions */
/** @typedef {import("./index.js").RawSourceMap} RawSourceMap */
/** @typedef {import("./index.js").EXPECTED_ANY} EXPECTED_ANY */
/** @typedef {import("./index.js").MinimizeFunctionHelpers} MinimizeFunctionHelpers */
/**
 * A concrete minify function, including optional worker-path helpers.
 * @typedef {import("./index.js").BasicMinimizerImplementation<CustomOptions> & MinimizeFunctionHelpers} MinimizerFn
 */
/**
 * @template T
 * @typedef {import("./index.js").MinimizerOptions<T>} MinimizerOptions
 */

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encode decoded mappings (per line, arrays of segments) into the spec's
 * `mappings` string, which is all `SourceMapSource` reads.
 * @param {number[][][]} decoded decoded mappings
 * @returns {string} encoded mappings
 */
function encodeMappings(decoded) {
  // Generated column restarts on every line; the other fields run on.
  const previous = [0, 0, 0, 0, 0];
  let result = "";

  for (let line = 0; line < decoded.length; line++) {
    if (line > 0) result += ";";

    previous[0] = 0;

    for (let i = 0; i < decoded[line].length; i++) {
      if (i > 0) result += ",";

      const segment = decoded[line][i];

      for (let field = 0; field < segment.length; field++) {
        const delta = segment[field] - previous[field];
        let vlq = delta < 0 ? (-delta << 1) | 1 : delta << 1;

        previous[field] = segment[field];

        do {
          let digit = vlq & 31;

          vlq >>>= 5;

          if (vlq > 0) digit |= 32;

          result += BASE64[digit];
        } while (vlq > 0);
      }
    }
  }

  return result;
}

/**
 * A minimizer's map as `SourceMapSource` reads it: a custom minimizer may
 * answer with decoded `mappings`, which it cannot.
 * @param {RawSourceMap | string} map source map
 * @returns {RawSourceMap | string} source map with encoded mappings
 */
function encodeSourceMap(map) {
  const raw = typeof map === "string" ? JSON.parse(map) : map;

  return Array.isArray(raw.mappings)
    ? { ...raw, mappings: encodeMappings(raw.mappings) }
    : map;
}

/**
 * Compose a freshly-produced source map with the input source map fed to
 * the minimizer. `currentMap` represents `name → step-output` and
 * `prevMap` represents `original → name`; the result represents
 * `original → step-output`.
 * @param {string} code code the minimizer produced
 * @param {RawSourceMap | undefined} currentMap map produced by the minimizer
 * @param {string | Buffer} input code fed to the minimizer
 * @param {RawSourceMap | undefined} prevMap input source map fed to the minimizer
 * @param {string} name name of the asset that the current map points to
 * @returns {RawSourceMap | undefined} composed map
 */
function composeSourceMaps(code, currentMap, input, prevMap, name) {
  if (!currentMap || !prevMap) {
    return currentMap;
  }

  // No compiler in a worker, so this is the installed webpack's own copy.
  const { SourceMapSource } = require("./sources").getSources();

  // `true` drops `name` itself: every mapping into it is traced on into
  // the previous map's sources.
  const map = new SourceMapSource(
    code,
    name,
    encodeSourceMap(currentMap),
    input,
    encodeSourceMap(prevMap),
    true,
  ).map();

  // No mappings at all leaves nothing to compose.
  if (!map) {
    return currentMap;
  }

  // `SourceMapSource` writes a placeholder `file` and an absent
  // `sourcesContent` as `undefined`; carry only what has a value.
  const { file, sourcesContent, ...composed } = map;

  return /** @type {RawSourceMap} */ ({
    ...composed,
    ...(currentMap.file ? { file: currentMap.file } : {}),
    ...(sourcesContent ? { sourcesContent } : {}),
  });
}

const { loadImplementation } = require("./implementation");

/**
 * @template T
 * @param {import("./index.js").InternalOptions<T>} options options
 * @returns {Promise<MinimizedResult>} minified result
 */
async function minify(options) {
  const { name, input, inputSourceMap, extractComments, module, ecma } =
    options;
  const { implementation, options: minimizerOptions } = options.minimizer;
  const implementations = Array.isArray(implementation)
    ? implementation
    : [implementation];

  /** @type {string | Buffer | undefined} */
  let lastCode;
  /** @type {string | undefined} */
  let lastFilename;
  let lastWidth;
  let lastHeight;
  /** @type {RawSourceMap | undefined} */
  let lastMap;
  /** @type {(Error | string)[]} */
  const warnings = [];
  /** @type {(Error | string)[]} */
  const errors = [];
  /** @type {string[]} */
  const extractedComments = [];

  /**
   * The options entry belonging to one minimizer: an array is parallel to the
   * implementations, a single object is shared by all of them.
   * @param {number} index index into the implementations
   * @returns {EXPECTED_ANY} its options
   */
  const optionsAt = (index) =>
    Array.isArray(minimizerOptions)
      ? minimizerOptions[index] || {}
      : minimizerOptions || {};

  // Source one language embeds in another carries no filename, so it is
  // dispatched across every configured minimizer rather than the ones this
  // asset's name matched — and by what each declared, which travels as data
  // because a minify function reaches a worker as source.
  const { embedded } = options;
  const embeddedImplementations = embedded
    ? /** @type {EXPECTED_ANY[]} */ (
        /** @type {unknown} */ (embedded.implementation)
      )
    : [];
  /**
   * @param {number} index index into the embedded implementations
   * @returns {EXPECTED_ANY} its options
   */
  const embeddedOptionsAt = (index) =>
    /** @type {EXPECTED_ANY[]} */ (
      /** @type {unknown} */ ((embedded || { options: [] }).options)
    )[index] || {};

  /**
   * The minimizers declaring `type` among the languages they minify. Source one
   * language embeds in another carries no filename, so `test` / `filter` cannot
   * dispatch it and `getTypes` answers instead.
   * @param {string} type the language
   * @returns {number[]} indices into the implementations
   */
  const claiming = (type) => {
    const matched = [];
    const claims = embedded ? embedded.claims : [];

    for (let i = 0; i < claims.length; i++) {
      if (claims[i].includes(type)) matched.push(i);
    }

    return matched;
  };

  /**
   * Minify one body a minimizer hands out from inside what it minifies, and
   * hand it back for the same print. Recursion is this function calling
   * `minify` again, so a body that nests something of its own is reached too.
   * Declining leaves the body exactly as the minimizer would have written it.
   *
   * What went wrong inside is answered with the body rather than pushed onto
   * this run: the minimizer collects it and reports it against the asset that
   * embeds it, which is the only one there is.
   * @param {string} source the nested body
   * @param {{ type: string, as?: string }} info what it is, and which production of it
   * @returns {Promise<{ code?: string, warnings?: (Error | string)[], errors?: (Error | string)[] } | undefined>} what came of it, or undefined
   */
  const renderEmbeddedSource = async (source, { type, as }) => {
    const matched = claiming(type);

    // `claiming` answers off `embedded`, so a match means there is one.
    if (matched.length === 0 || embedded === undefined) return undefined;

    const nested = await minify({
      /** @type {EXPECTED_ANY} */
      name,
      input: source,
      inputSourceMap: undefined,
      extractComments: false,
      // What the target can read is the target's, not the asset's, so it carries
      // into the body too: an inline `<script>` is minified for the same engines
      // the document is. `module` does not — an inline script is a classic script
      // whatever the file embedding it is.
      ecma,
      // The nested minimizers are these indices, so `at` moves with them.
      embedded: { ...embedded, at: matched },
      minimizer: {
        implementation:
          /** @type {EXPECTED_ANY} */
          (matched.map((i) => embeddedImplementations[i])),
        // `as` says which production of `type` this body is — an HTML `style=""`
        // is CSS, but a block's contents rather than a stylesheet. It is the
        // body's, not the configuration's, so it overrides.
        options: /** @type {EXPECTED_ANY} */ (
          matched.map((i) =>
            as === undefined
              ? embeddedOptionsAt(i)
              : { ...embeddedOptionsAt(i), as },
          )
        ),
      },
    });

    /** @type {{ code?: string, warnings?: (Error | string)[], errors?: (Error | string)[] }} */
    const answer = {};

    if (nested.warnings && nested.warnings.length > 0) {
      answer.warnings = nested.warnings;
    }

    if (nested.errors && nested.errors.length > 0) {
      answer.errors = nested.errors;
    }

    // A body that failed keeps the text it was written with, which is what
    // answering without a `code` spells.
    if (
      (!nested.errors || nested.errors.length === 0) &&
      typeof nested.code === "string"
    ) {
      answer.code = nested.code;
    }

    return answer;
  };

  /**
   * Whether `index`'s minimizer could hand out a language something configured
   * here claims. False means offering it would only ever reach bodies with
   * nowhere to go, so the option is left off and it prints as it always has.
   * @param {number} index index into the implementations
   * @returns {boolean} true when some nested language is reachable
   */
  const reachesEmbedded = (index) =>
    embedded !== undefined &&
    (embedded.offers[embedded.at[index]] || []).some(
      (type) => claiming(type).length > 0,
    );

  for (let i = 0; i < implementations.length; i++) {
    const currentImplementation =
      /** @type {import("./index.js").BasicMinimizerImplementation<T> & import("./index.js").MinimizeFunctionHelpers} */
      (loadImplementation(implementations[i]));
    const baseOptions =
      /** @type {import("./index.js").MinimizerOptions<T> & { module?: boolean, ecma?: number | string }} */
      (optionsAt(i));
    // A binary minimizer answers with a `Buffer`, so "did the last step
    // produce something" is not "is it a string".
    const currentInput =
      typeof lastCode === "string" || Buffer.isBuffer(lastCode)
        ? lastCode
        : input;
    const currentMap =
      typeof lastCode === "string" || Buffer.isBuffer(lastCode)
        ? lastMap
        : inputSourceMap;

    // Overlay `module` and `ecma` without mutating the caller's options so
    // a single options object can be reused safely across assets.
    const currentOptions =
      /** @type {import("./index.js").MinimizerOptions<T>} */
      ({
        ...baseOptions,
        // An explicit `false` is a choice, not an absent value, so only an
        // absent one falls back to what webpack inferred.
        module:
          typeof baseOptions.module === "undefined"
            ? module
            : baseOptions.module,
        ecma: baseOptions.ecma || ecma,
        // Only for a minimizer that says it reads the option: every other one is
        // handed its own options untouched, so nothing sees a key it does not know.
        ...(reachesEmbedded(i) ? { renderEmbeddedSource } : {}),
      });

    const result = await currentImplementation(
      { [name]: currentInput },
      currentMap,
      currentOptions,
      extractComments,
    );

    if (result.warnings && result.warnings.length > 0) {
      warnings.push(...result.warnings);
    }

    if (result.errors && result.errors.length > 0) {
      errors.push(...result.errors);
    }

    if (result.extractedComments && result.extractedComments.length > 0) {
      extractedComments.push(...result.extractedComments);
    }

    // A minimizer that re-encoded the bytes into another format says what the
    // result is now called; across a chain the last such answer wins.
    if (typeof result.filename === "string") {
      lastFilename = result.filename;
    }

    // The size it now has, where the re-encoder knows it. Last answer wins,
    // as the name does.
    if (typeof result.width === "number") {
      lastWidth = result.width;
    }

    if (typeof result.height === "number") {
      lastHeight = result.height;
    }

    if (typeof result.code === "string" || Buffer.isBuffer(result.code)) {
      lastCode = result.code;
      // The minimizer's output map is `name → step-output`. Chain it with
      // the previous accumulated map so that across an array of minimizers
      // the final map points back to the original sources. Bytes carry none.
      lastMap = Buffer.isBuffer(result.code)
        ? undefined
        : composeSourceMaps(
            result.code,
            result.map,
            currentInput,
            currentMap,
            name,
          );
    }
  }

  return {
    code: lastCode,
    // Only when one was named: almost nothing re-encodes into another format,
    // and an always-present `filename: undefined` is in every result's shape.
    ...(typeof lastFilename === "string" ? { filename: lastFilename } : {}),
    ...(typeof lastWidth === "number" ? { width: lastWidth } : {}),
    ...(typeof lastHeight === "number" ? { height: lastHeight } : {}),
    map: lastMap,
    warnings,
    errors,
    extractedComments,
  };
}

/**
 * @param {string} options options
 * @returns {Promise<MinimizedResult>} minified result
 */
async function transform(options) {
  // Legacy worker path: the whole task (including minify function source) is a
  // string evaluated here. Prefer `minify` when every `implementation` is a
  // module path (`string` / `{ path, export }`) so the worker can `require` it.
  // 'use strict' => this === undefined (Clean Scope)
  // Safer for possible security issues, albeit not critical at all here

  const evaluatedOptions =
    /**
     * @template T
     * @type {import("./index.js").InternalOptions<T>}
     */
    (
      // eslint-disable-next-line no-new-func
      new Function(
        "exports",
        "require",
        "module",
        "__filename",
        "__dirname",
        `'use strict'\nreturn ${options}`,
        // eslint-disable-next-line n/exports-style
      )(exports, require, module, __filename, __dirname)
    );

  return minify(evaluatedOptions);
}

module.exports = {
  minify,
  transform,
};
