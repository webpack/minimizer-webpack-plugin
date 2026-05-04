/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */
/** @typedef {import("./index.js").CustomOptions} CustomOptions */
/** @typedef {import("./index.js").RawSourceMap} RawSourceMap */
/**
 * @template T
 * @typedef {import("./index.js").MinimizerOptions<T>} MinimizerOptions
 */

/**
 * @typedef {number[]} DecodedSegment
 */

/* eslint-disable prefer-destructuring */

const VLQ_BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** @type {Record<string, number>} */
const VLQ_BASE64_INDEX = {};

for (let i = 0; i < VLQ_BASE64.length; i++) {
  VLQ_BASE64_INDEX[VLQ_BASE64[i]] = i;
}

/**
 * Decode a Base64 VLQ string into a list of integers.
 * @param {string} str VLQ-encoded segment
 * @returns {number[]} decoded integers
 */
function decodeVlq(str) {
  /** @type {number[]} */
  const result = [];
  let value = 0;
  let shift = 0;

  for (let i = 0; i < str.length; i++) {
    const digit = VLQ_BASE64_INDEX[str[i]];

    if (typeof digit === "undefined") {
      throw new Error(`Invalid Base64 VLQ character "${str[i]}"`);
    }

    const continuation = digit & 0b100000;

    value += (digit & 0b11111) << shift;

    if (continuation) {
      shift += 5;
    } else {
      const isNegative = value & 1;

      value >>>= 1;
      result.push(isNegative ? -value : value);
      value = 0;
      shift = 0;
    }
  }

  return result;
}

/**
 * Encode a single integer as Base64 VLQ as used by the source-map spec.
 * @param {number} value integer to encode
 * @returns {string} encoded VLQ characters
 */
function encodeVlq(value) {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
  let out = "";

  do {
    let digit = vlq & 0b11111;

    vlq >>>= 5;

    if (vlq > 0) {
      digit |= 0b100000;
    }

    out += VLQ_BASE64[digit];
  } while (vlq > 0);

  return out;
}

/**
 * Decode a source-map `mappings` string into per-line arrays of segments.
 * @param {string} mappings encoded `mappings` field
 * @returns {DecodedSegment[][]} decoded mappings
 */
function decodeMappings(mappings) {
  /** @type {DecodedSegment[][]} */
  const lines = [];
  let prevSourceIdx = 0;
  let prevOriginalLine = 0;
  let prevOriginalColumn = 0;
  let prevNameIdx = 0;

  const lineStrings = mappings.split(";");

  for (let lineIndex = 0; lineIndex < lineStrings.length; lineIndex++) {
    const lineStr = lineStrings[lineIndex];
    /** @type {DecodedSegment[]} */
    const segments = [];
    let prevGeneratedColumn = 0;

    if (lineStr.length > 0) {
      const segmentStrings = lineStr.split(",");

      for (let segIdx = 0; segIdx < segmentStrings.length; segIdx++) {
        const decoded = decodeVlq(segmentStrings[segIdx]);

        prevGeneratedColumn += decoded[0];

        if (decoded.length === 1) {
          segments.push([prevGeneratedColumn]);
        } else if (decoded.length === 4) {
          prevSourceIdx += decoded[1];
          prevOriginalLine += decoded[2];
          prevOriginalColumn += decoded[3];
          segments.push([
            prevGeneratedColumn,
            prevSourceIdx,
            prevOriginalLine,
            prevOriginalColumn,
          ]);
        } else if (decoded.length === 5) {
          prevSourceIdx += decoded[1];
          prevOriginalLine += decoded[2];
          prevOriginalColumn += decoded[3];
          prevNameIdx += decoded[4];
          segments.push([
            prevGeneratedColumn,
            prevSourceIdx,
            prevOriginalLine,
            prevOriginalColumn,
            prevNameIdx,
          ]);
        }
      }
    }

    lines.push(segments);
  }

  return lines;
}

/**
 * Encode decoded source-map mappings (per-line arrays of segments) back into
 * the spec's `mappings` string.
 * @param {DecodedSegment[][]} decoded mappings as nested arrays of segments
 * @returns {string} encoded `mappings` field
 */
function encodeMappings(decoded) {
  let result = "";
  let prevSourceIdx = 0;
  let prevOriginalLine = 0;
  let prevOriginalColumn = 0;
  let prevNameIdx = 0;

  for (let line = 0; line < decoded.length; line++) {
    if (line > 0) {
      result += ";";
    }

    let prevGeneratedColumn = 0;
    const segments = decoded[line];

    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        result += ",";
      }

      const seg = segments[i];

      result += encodeVlq(seg[0] - prevGeneratedColumn);
      prevGeneratedColumn = seg[0];

      if (seg.length >= 4) {
        result += encodeVlq(seg[1] - prevSourceIdx);
        prevSourceIdx = seg[1];
        result += encodeVlq(seg[2] - prevOriginalLine);
        prevOriginalLine = seg[2];
        result += encodeVlq(seg[3] - prevOriginalColumn);
        prevOriginalColumn = seg[3];

        if (seg.length >= 5) {
          result += encodeVlq(seg[4] - prevNameIdx);
          prevNameIdx = seg[4];
        }
      }
    }
  }

  return result;
}

/**
 * Look up the original source position for a generated `(line, column)`
 * within decoded mappings. Returns `null` when no mapping covers the
 * requested position.
 * @param {DecodedSegment[][]} decoded decoded mappings
 * @param {number} lineIndex 0-based generated line
 * @param {number} columnIndex 0-based generated column
 * @returns {{ sourceIdx: number, originalLine: number, originalColumn: number, nameIdx: number } | null} mapped position
 */
function originalPositionFor(decoded, lineIndex, columnIndex) {
  if (lineIndex < 0 || lineIndex >= decoded.length) {
    return null;
  }

  const segments = decoded[lineIndex];

  if (segments.length === 0) {
    return null;
  }

  // Binary-search for the largest segment whose generated column is `<=`
  // the requested column.
  let low = 0;
  let high = segments.length;

  while (low < high) {
    const mid = (low + high) >>> 1;

    if (segments[mid][0] <= columnIndex) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const idx = low - 1;

  if (idx < 0) {
    return null;
  }

  const seg = segments[idx];

  if (seg.length < 4) {
    return null;
  }

  return {
    sourceIdx: /** @type {number} */ (seg[1]),
    originalLine: /** @type {number} */ (seg[2]),
    originalColumn: /** @type {number} */ (seg[3]),
    nameIdx: seg.length >= 5 ? /** @type {number} */ (seg[4]) : -1,
  };
}

/**
 * Compose a freshly-produced source map with the input source map fed to
 * the minimizer. `currentMap` represents `name → step-output` and
 * `prevMap` represents `original → name`; the result represents
 * `original → step-output`.
 * @param {RawSourceMap | undefined} currentMap map produced by the minimizer
 * @param {RawSourceMap | undefined} prevMap input source map fed to the minimizer
 * @param {string} name name of the asset that the current map points to
 * @returns {RawSourceMap | undefined} composed map
 */
function composeSourceMaps(currentMap, prevMap, name) {
  if (!currentMap || !prevMap) {
    return currentMap;
  }

  // Custom minimizers may return the map as a JSON string (e.g. terser's
  // default output). Parse so downstream code can rely on object access.
  const current =
    typeof currentMap === "string"
      ? /** @type {RawSourceMap} */ (JSON.parse(currentMap))
      : currentMap;
  const previous =
    typeof prevMap === "string"
      ? /** @type {RawSourceMap} */ (JSON.parse(prevMap))
      : prevMap;

  if (
    !current ||
    typeof current.mappings !== "string" ||
    !previous ||
    typeof previous.mappings !== "string"
  ) {
    return currentMap;
  }

  const currentDecoded = decodeMappings(current.mappings);
  const previousDecoded = decodeMappings(previous.mappings);
  const currentSources = (current.sources || []).map(
    /**
     * @param {string | null} source source name
     * @returns {string} normalized source name
     */
    (source) => source || "",
  );
  const currentSourcesContent = current.sourcesContent || [];
  const currentNames = current.names || [];
  const previousSources = (previous.sources || []).map(
    /**
     * @param {string | null} source source name
     * @returns {string} normalized source name
     */
    (source) => source || "",
  );
  const previousSourcesContent = previous.sourcesContent || [];
  const previousNames = previous.names || [];

  /** @type {string[]} */
  const sources = [];
  /** @type {(string | null)[]} */
  const sourcesContent = [];
  /** @type {string[]} */
  const names = [];
  /** @type {Map<string, number>} */
  const sourceIdx = new Map();
  /** @type {Map<string, number>} */
  const nameIdx = new Map();

  /**
   * @param {string} source source identifier
   * @param {string | undefined} content source content (when available)
   * @returns {number} index assigned in the composed map
   */
  const getSourceIdx = (source, content) => {
    let idx = sourceIdx.get(source);

    if (typeof idx === "undefined") {
      idx = sources.length;
      sources.push(source);
      sourcesContent.push(typeof content === "string" ? content : null);
      sourceIdx.set(source, idx);
    } else if (typeof content === "string" && sourcesContent[idx] === null) {
      sourcesContent[idx] = content;
    }

    return idx;
  };

  /**
   * @param {string} value name
   * @returns {number} index assigned in the composed map
   */
  const getNameIdx = (value) => {
    let idx = nameIdx.get(value);

    if (typeof idx === "undefined") {
      idx = names.length;
      names.push(value);
      nameIdx.set(value, idx);
    }

    return idx;
  };

  /** @type {DecodedSegment[][]} */
  const composed = [];

  for (let line = 0; line < currentDecoded.length; line++) {
    /** @type {DecodedSegment[]} */
    const newSegments = [];

    for (let i = 0; i < currentDecoded[line].length; i++) {
      const seg = currentDecoded[line][i];

      // Single-element segment is just a generated column with no source info
      if (seg.length < 4) {
        newSegments.push([seg[0]]);
        continue;
      }

      const sourceName = currentSources[/** @type {number} */ (seg[1])];
      const origLine = /** @type {number} */ (seg[2]);
      const origCol = /** @type {number} */ (seg[3]);
      const segName =
        seg.length >= 5 ? currentNames[/** @type {number} */ (seg[4])] : null;

      // When the segment points back at our intermediate `name`, look up
      // the original position in the previous map and emit a mapping that
      // points all the way back. Otherwise keep the segment as-is.
      if (sourceName === name) {
        const orig = originalPositionFor(previousDecoded, origLine, origCol);

        if (!orig) {
          continue;
        }

        const previousSource = previousSources[orig.sourceIdx];

        if (typeof previousSource !== "string") {
          continue;
        }

        const content =
          typeof previousSourcesContent[orig.sourceIdx] === "string"
            ? /** @type {string} */
              (previousSourcesContent[orig.sourceIdx])
            : undefined;
        const newSrcIdx = getSourceIdx(previousSource, content);
        const finalName =
          orig.nameIdx >= 0 && previousNames[orig.nameIdx]
            ? previousNames[orig.nameIdx]
            : segName;

        if (typeof finalName === "string") {
          newSegments.push([
            seg[0],
            newSrcIdx,
            orig.originalLine,
            orig.originalColumn,
            getNameIdx(finalName),
          ]);
        } else {
          newSegments.push([
            seg[0],
            newSrcIdx,
            orig.originalLine,
            orig.originalColumn,
          ]);
        }
      } else {
        const content =
          typeof currentSourcesContent[/** @type {number} */ (seg[1])] ===
          "string"
            ? /** @type {string} */
              (currentSourcesContent[/** @type {number} */ (seg[1])])
            : undefined;
        const newSrcIdx = getSourceIdx(sourceName, content);

        if (typeof segName === "string") {
          newSegments.push([
            seg[0],
            newSrcIdx,
            origLine,
            origCol,
            getNameIdx(segName),
          ]);
        } else {
          newSegments.push([seg[0], newSrcIdx, origLine, origCol]);
        }
      }
    }

    composed.push(newSegments);
  }

  /** @type {RawSourceMap} */
  const result =
    /** @type {RawSourceMap} */
    (
      /** @type {unknown} */ ({
        version: 3,
        sources,
        names,
        mappings: encodeMappings(composed),
      })
    );

  if (current.file) {
    result.file = current.file;
  }

  if (sourcesContent.some((value) => typeof value === "string")) {
    result.sourcesContent =
      /** @type {string[]} */
      (/** @type {unknown} */ (sourcesContent));
  }

  return result;
}
/* eslint-enable prefer-destructuring */

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

  /** @type {string | undefined} */
  let lastCode;
  /** @type {RawSourceMap | undefined} */
  let lastMap;
  /** @type {(Error | string)[]} */
  const warnings = [];
  /** @type {(Error | string)[]} */
  const errors = [];
  /** @type {string[]} */
  const extractedComments = [];

  for (let i = 0; i < implementations.length; i++) {
    const currentImplementation =
      /** @type {import("./index.js").BasicMinimizerImplementation<T> & import("./index.js").MinimizeFunctionHelpers} */
      (implementations[i]);
    const currentOptions =
      /** @type {import("./index.js").MinimizerOptions<T>} */
      (
        Array.isArray(minimizerOptions)
          ? minimizerOptions[i] || {}
          : minimizerOptions || {}
      );
    const currentInput = typeof lastCode === "string" ? lastCode : input;
    const currentMap = typeof lastCode === "string" ? lastMap : inputSourceMap;

    /** @type {MinimizerOptions<T & { module?: boolean }>} */
    (currentOptions).module =
      /** @type {MinimizerOptions<T & { module?: boolean }>} */
      (currentOptions).module || module;
    /** @type {MinimizerOptions<T & { ecma?: number | string }>} */
    (currentOptions).ecma =
      /** @type {MinimizerOptions<T & { ecma?: number | string }>} */
      (currentOptions).ecma || ecma;

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

    if (typeof result.code === "string") {
      lastCode = result.code;
      // The minimizer's output map is `name → step-output`. Chain it with
      // the previous accumulated map so that across an array of minimizers
      // the final map points back to the original sources.
      lastMap = composeSourceMaps(result.map, currentMap, name);
    }
  }

  return {
    code: lastCode,
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

module.exports = { minify, transform };
