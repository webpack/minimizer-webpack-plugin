export = MinimizerPlugin;
/**
 * @template [T=import("terser").MinifyOptions]
 */
declare class MinimizerPlugin<T = import("terser").MinifyOptions> {
  /**
   * @private
   * @param {unknown} input Input to check
   * @returns {boolean} Whether input is a source map
   */
  private static isSourceMap;
  /**
   * @private
   * @param {unknown} warning warning
   * @param {string} file file
   * @returns {Error} built warning
   */
  private static buildWarning;
  /**
   * @private
   * @param {Error | ErrorObject | string} error error
   * @param {string} file file
   * @param {TraceMap=} sourceMap source map
   * @param {Compilation["requestShortener"]=} requestShortener request shortener
   * @returns {Error} built error
   */
  private static buildError;
  /**
   * @private
   * @param {Parallel} parallel value of the `parallel` option
   * @returns {number} number of cores for parallelism
   */
  private static getAvailableNumberOfCores;
  /**
   * @param {BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>=} options options
   */
  constructor(
    options?:
      (BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>) | undefined,
  );
  /**
   * @private
   * @type {BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>}
   */
  private rawOptions;
  /**
   * @private
   * @type {InternalPluginOptions<T>}
   */
  private options;
  /**
   * Whether `test`, `include` and `exclude` accept a name.
   *
   * An asset name carries the query and fragment of the request that made it
   * — `output.assetModuleFilename` is `[hash][ext][query][fragment]` by
   * default — so `test: /\.png$/` would match none of them. Both spellings
   * are offered: a rule naming the file accepts it whatever it carries, and
   * one naming the query still works.
   * @private
   * @param {Compiler} compiler compiler
   * @param {string} name asset name, or a module's resource
   * @returns {boolean} true when it is to be minified
   */
  private matchesName;
  /**
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {Record<string, import("webpack").sources.Source>} assets assets
   * @param {{ availableNumberOfCores: number, only?: number[], cacheSuffix?: string, written: Map<string, Set<string>> }} optimizeOptions how many may run at once, which minimizers this pass runs, what keeps its cache apart from another pass over the same asset, and what an earlier pass of this plugin already wrote onto each asset
   * @returns {Promise<void>}
   */
  private optimize;
  /**
   * Every configured minimizer, in order. The `minify` option takes one or an
   * array; embedded source is dispatched across all of them either way.
   * @private
   * @returns {(BasicMinimizerImplementation<EXPECTED_ANY> & MinimizeFunctionHelpers)[]} the minimizers
   */
  private minimizers;
  /**
   * Every configured minimizer and its options, for dispatching source one
   * language embeds in another. The asset's own entry holds only what its
   * filename matched, and a language's minimizer need not be among them — a
   * `.css` asset embedding an `<svg>` reaches an SVG minifier that claims no
   * asset at all.
   * @private
   * @param {number[]} matched indices of the minimizers this input's own entry holds
   * @returns {{ implementation: MinimizerImplementation<T>, options: MinimizerOptions<T>, claims: string[][], offers: string[][], at: number[] } | undefined} every configured minimizer, or undefined when nothing nested could be reached
   */
  private embeddedMinimizer;
  /**
   * One generator, however it was written: as the generator itself or as an
   * object stating how to run it.
   * @private
   * @param {string | undefined} name the preset it is written under, where it has one
   * @param {EXPECTED_ANY} entry what was written there
   * @param {EXPECTED_ANY} declared what `generatorOptions` says for it
   * @returns {{ name: string | undefined, implementation: EXPECTED_ANY, options: EXPECTED_ANY, type: string | undefined, filename: string | undefined, filter: ((name: string) => boolean) | undefined, deleteOriginalAssets: boolean | undefined, threshold: number | undefined, minRatio: number | undefined, relatedName: string | false | undefined }} the generator
   */
  private describeGenerator;
  /**
   * Every generator `generate` holds, whichever shape it was written in.
   * @private
   * @returns {ReturnType<MinimizerPlugin["describeGenerator"]>[]} them, in the order they were written
   */
  private generators;
  /**
   * The generator a module asks for by name, or the only one there is.
   *
   * A `generate` naming its generators is picked between by `?as=`: a module
   * that names none is left alone, and one that names a generator nothing
   * defines is an error rather than a silent decline.
   * @private
   * @param {Compilation} compilation compilation
   * @param {string} resource the module's resource, query and all
   * @returns {{ implementation: MinimizerImplementation<EXPECTED_ANY>, options: MinimizerOptions<EXPECTED_ANY> } | undefined} the generator to run, or undefined to run none
   */
  private generatorFor;
  /**
   * Whether any generator rewrites a module as it builds. Only that kind needs
   * `processResult` to be able to await; an `asset` generator does not.
   * @private
   * @returns {boolean} true when one does
   */
  private hasModuleGenerator;
  /**
   * Every name the functions this plugin runs mark an asset with, which is
   * what stats have to know how to print.
   * @private
   * @returns {Set<string>} the names
   */
  private assetFlags;
  /**
   * Every name this plugin's `asset` generators mark what they wrote with,
   * which is how both passes tell a generated file from one to work on.
   * @private
   * @returns {string[]} the names
   */
  private generatedFlags;
  /**
   * The generators that run over emitted assets rather than over a module as
   * it builds.
   * @private
   * @returns {ReturnType<MinimizerPlugin["describeGenerator"]>[]} them, in the order they were written
   */
  private assetGenerators;
  /**
   * Carries the generator's identity into the persistent cache's version.
   * A generator rewrites a module's own build result, which the pack restores
   * without rebuilding, and nothing per-module keys on a plugin.
   * @private
   * @param {Compiler} compiler compiler
   * @returns {void}
   */
  private saltCacheVersion;
  /**
   * Generate one new asset from one already emitted, leaving the original in
   * place unless the generator asked for it to go.
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {ReturnType<Compilation["getCache"]>} cache the generation cache
   * @param {Asset} asset the asset to generate from
   * @param {ReturnType<MinimizerPlugin["assetGenerators"]>[0]} generator the generator to run
   * @returns {Promise<void>}
   */
  private generateAsset;
  /**
   * Generate new assets from the ones already emitted. Where `generate`
   * rewrites a module's own bytes as it builds, this adds a file beside one
   * that is already named, so nothing has to import it.
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {ReturnType<MinimizerPlugin["assetGenerators"]>} generators the generators running at this stage
   * @param {Record<string, import("webpack").sources.Source>} assets the assets this pass was handed
   * @returns {Promise<void>}
   */
  private generateAssets;
  /**
   * Where work runs when nothing asks for anywhere else: after the bundle is
   * rendered and before its hashes are taken, which is where minifying belongs.
   * @private
   * @param {Compiler} compiler compiler
   * @returns {number} the stage
   */
  private defaultStage;
  /**
   * Which minimizers run at which `processAssets` stage, as indices into the
   * configured ones. Each runs where its own `getStage` asks to, and they
   * still chain — through the asset, which the later pass reads back.
   * @private
   * @param {Compiler} compiler compiler
   * @returns {Map<number, number[]>} the indices, by stage
   */
  private minimizersByStage;
  /**
   * Minify one source a module embeds in another language's output — CSS or
   * HTML reaching the bundle inside a JavaScript string literal, an
   * `asset/source` file's text, an `asset/inline` payload. No asset carries
   * this text, so there is no filename to dispatch by: it goes to whichever
   * minimizer declares `info.type` among the languages it minifies.
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {import("webpack").sources.Source} variesOn everything the minified answer varies on beyond the source itself
   * @param {import("webpack").sources.Source} source the embedded source
   * @param {EmbeddedSourceInfo} info what it is and where it is going
   * @returns {Promise<import("webpack").sources.Source>} the minified source, or the original
   */
  private renderEmbeddedSource;
  /**
   * Rewrite one module's own bytes as it is built, which is where an asset can
   * still be renamed: its emitted name and its hash are both read afterwards,
   * so a re-encoding that changes the format changes the extension with it.
   * `processAssets` is too late for that — the bundle already refers to the
   * name the asset had.
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {import("webpack").sources.Source} variesOn everything the answer varies on beyond the bytes themselves
   * @param {LoaderResult} result what the loaders produced
   * @param {import("webpack").NormalModule} module the module being built
   * @returns {Promise<LoaderResult>} the result, rewritten or as it came
   */
  private generate;
  /**
   * The same check as `validateGenerators`, for a minimizer: its options
   * cannot come from `minify` and the deprecated `minimizerOptions` both.
   * @private
   * @returns {void}
   */
  private validateMinimizers;
  /**
   * Cross-field checks the schema cannot make: options given twice for one
   * generator, and a `generatorOptions` key naming no generator.
   * @private
   * @returns {void}
   */
  private validateGenerators;
  /**
   * Validates the options the plugin was constructed with.
   * @private
   * @param {Compiler} compiler compiler
   * @returns {void}
   */
  private validateOptions;
  /**
   * @param {Compiler} compiler compiler
   * @returns {void}
   */
  apply(compiler: Compiler): void;
}
declare namespace MinimizerPlugin {
  export {
    terserMinify,
    uglifyJsMinify,
    swcMinify,
    esbuildMinify,
    jsonMinify,
    htmlMinifierTerser,
    swcMinifyHtml,
    swcMinifyHtmlFragment,
    minifyHtmlNode,
    cssnanoMinify,
    cssoMinify,
    cleanCssMinify,
    esbuildMinifyCss,
    lightningCssMinify,
    swcMinifyCss,
    imageminGenerate,
    imageminMinify,
    imageminNormalizeConfig,
    napiRsImageMinify,
    sharpMinify,
    sharpGenerate,
    svgoMinify,
    compress,
    Schema,
    Compiler,
    Compilation,
    Asset,
    AssetInfo,
    TemplatePath,
    JestWorker,
    RawSourceMap,
    TraceMap,
    Rule,
    Rules,
    EXPECTED_ANY,
    EXPECTED_OBJECT,
    ExtractCommentsFunction,
    ExtractCommentsCondition,
    ExtractCommentsFilename,
    ExtractCommentsBanner,
    ExtractCommentsObject,
    ExtractCommentsOptions,
    ErrorObject,
    EmbeddedSourceInfo,
    EmbeddedSourceHooks,
    LoaderResult,
    AwaitableModuleHooks,
    MinimizedResult,
    Input,
    CustomOptions,
    InferDefaultType,
    MinimizerOptions,
    BasicMinimizerImplementation,
    MinimizeFunctionHelpers,
    MinimizerImplementation,
    InternalOptions,
    MinimizerWorker,
    Parallel,
    GeneratorDescriptor,
    Generate,
    BasePluginOptions,
    DefinedDefaultMinimizerAndOptions,
    InternalPluginOptions,
  };
}
import { terserMinify } from "./utils";
import { uglifyJsMinify } from "./utils";
import { swcMinify } from "./utils";
import { esbuildMinify } from "./utils";
import { jsonMinify } from "./utils";
import { htmlMinifierTerser } from "./utils";
import { swcMinifyHtml } from "./utils";
import { swcMinifyHtmlFragment } from "./utils";
import { minifyHtmlNode } from "./utils";
import { cssnanoMinify } from "./utils";
import { cssoMinify } from "./utils";
import { cleanCssMinify } from "./utils";
import { esbuildMinifyCss } from "./utils";
import { lightningCssMinify } from "./utils";
import { swcMinifyCss } from "./utils";
import { imageminGenerate } from "./utils";
import { imageminMinify } from "./utils";
import { imageminNormalizeConfig } from "./utils";
import { napiRsImageMinify } from "./utils";
import { sharpMinify } from "./utils";
import { sharpGenerate } from "./utils";
import { svgoMinify } from "./utils";
import { compress } from "./utils";
type Schema = import("schema-utils/declarations/validate").Schema;
type Compiler = import("webpack").Compiler;
type Compilation = import("webpack").Compilation;
type Asset = import("webpack").Asset;
type AssetInfo = import("webpack").AssetInfo;
type TemplatePath = import("webpack").TemplatePath;
type JestWorker = import("jest-worker").Worker;
type RawSourceMap = import("@jridgewell/trace-mapping").EncodedSourceMap & {
  sources: string[];
  sourcesContent?: string[];
  file: string;
};
type TraceMap = import("@jridgewell/trace-mapping").TraceMap;
type Rule = RegExp | string;
type Rules = Rule[] | Rule;
type EXPECTED_ANY = any;
type EXPECTED_OBJECT = object;
type ExtractCommentsFunction = (
  astNode: EXPECTED_ANY,
  comment: {
    value: string;
    type: "comment1" | "comment2" | "comment3" | "comment4";
    pos: number;
    line: number;
    col: number;
  },
) => boolean;
type ExtractCommentsCondition =
  boolean | "all" | "some" | RegExp | ExtractCommentsFunction;
type ExtractCommentsFilename = TemplatePath;
type ExtractCommentsBanner =
  boolean | string | ((commentsFile: string) => string);
type ExtractCommentsObject = {
  /**
   * condition which comments need to be expected
   */
  condition?: ExtractCommentsCondition | undefined;
  /**
   * filename for extracted comments
   */
  filename?: ExtractCommentsFilename | undefined;
  /**
   * banner in filename for extracted comments
   */
  banner?: ExtractCommentsBanner | undefined;
};
type ExtractCommentsOptions = ExtractCommentsCondition | ExtractCommentsObject;
type ErrorObject = {
  /**
   * message
   */
  message: string;
  /**
   * line number
   */
  line?: number | undefined;
  /**
   * column number
   */
  column?: number | undefined;
  /**
   * error stack trace
   */
  stack?: string | undefined;
};
/**
 * What one embedded source is and where it is going, as
 * `renderEmbeddedSource` describes it.
 */
type EmbeddedSourceInfo = {
  /**
   * the embedded source's language, e.g. `"css"`
   */
  type: string;
  /**
   * the language of the output it is embedded in
   */
  hostType: string;
  /**
   * the module being generated
   */
  module: import("webpack").Module;
};
/**
 * The two hooks webpack >= 5.110 adds. Declared here rather than read off
 * `Compilation`: the plugin supports webpack `^5.1.0`, whose types have
 * neither, and it does nothing at all where they are absent.
 */
type EmbeddedSourceHooks = {
  /**
   * offers each embedded source before it is embedded
   */
  renderEmbeddedSource?:
    | {
        tapPromise: (
          name: string,
          fn: (
            source: import("webpack").sources.Source,
            info: EmbeddedSourceInfo,
          ) => Promise<import("webpack").sources.Source>,
        ) => void;
      }
    | undefined;
  /**
   * hashes what a `renderEmbeddedSource` tap varies on
   */
  embeddedSourceHash?:
    | {
        tap: (
          name: string,
          fn: (
            module: import("webpack").Module,
            hash: {
              update: (data: string) => void;
            },
          ) => void,
        ) => void;
      }
    | undefined;
};
/**
 * What the loaders produced for one module, as `processResult` hands it over.
 */
type LoaderResult = [
  string | Buffer,
  string | RawSourceMap | undefined,
  EXPECTED_ANY,
];
/**
 * The `NormalModule` hook this plugin generates through. Declared here for the
 * same reason as `EmbeddedSourceHooks`: it can await only from webpack 5.111,
 * and the supported range's types still describe it as synchronous.
 */
type AwaitableModuleHooks = {
  /**
   * offers each module's own bytes as it is built
   */
  processResult: {
    tapPromise: (
      name: string,
      fn: (
        result: LoaderResult,
        module: import("webpack").NormalModule,
      ) => Promise<LoaderResult>,
    ) => void;
  };
};
type MinimizedResult = {
  /**
   * code — a `Buffer` from a minimizer that declares `supportsBinary`
   */
  code?: (string | Buffer) | undefined;
  /**
   * the name the result should carry, when re-encoding it changed what the bytes are. Only the `generate` path can honour it: an asset is named while its module is built, before anything downstream refers to it
   */
  filename?: string | undefined;
  /**
   * what the result is now wide, where re-encoding knows it. `[width]` in an `asset` generator's `filename` reads it
   */
  width?: number | undefined;
  /**
   * what the result is now tall, where re-encoding knows it
   */
  height?: number | undefined;
  /**
   * source map
   */
  map?: RawSourceMap | undefined;
  /**
   * errors
   */
  errors?: (Error | string)[] | undefined;
  /**
   * warnings
   */
  warnings?: (Error | string)[] | undefined;
  /**
   * extracted comments
   */
  extractedComments?: string[] | undefined;
};
type Input = {
  [file: string]: string | Buffer;
};
type CustomOptions = {
  [key: string]: EXPECTED_ANY;
};
type InferDefaultType<T> = T extends infer U ? U : CustomOptions;
type MinimizerOptions<T> = T extends EXPECTED_ANY[]
  ? { [P in keyof T]?: T[P] & InferDefaultType<T[P]> }
  : T & InferDefaultType<T>;
type BasicMinimizerImplementation<T> = (
  input: Input,
  sourceMap: RawSourceMap | undefined,
  minifyOptions: MinimizerOptions<T>,
  extractComments: ExtractCommentsOptions | undefined,
) => Promise<MinimizedResult> | MinimizedResult;
type MinimizeFunctionHelpers = {
  /**
   * function that returns version of minimizer
   */
  getMinimizerVersion?: (() => string | undefined) | undefined;
  /**
   * true when minimizer support worker threads, otherwise false
   */
  supportsWorkerThreads?: (() => boolean | undefined) | undefined;
  /**
   * true when minimizer support worker, otherwise false
   */
  supportsWorker?: (() => boolean | undefined) | undefined;
  /**
   * true when the minimizer takes the asset's bytes rather than its text — an image minimizer. Its input reaches it as a `Buffer` and its `code` may be one. Only when every minimizer an asset is dispatched to declares it, since one that does not could not read the bytes
   */
  supportsBinary?: (() => boolean | undefined) | undefined;
  /**
   * return true when the minimizer supports the asset, otherwise false. When an array of minimizers is configured, each asset is dispatched only to the minimizers whose `filter` accepts it. Assets rejected by every minimizer in the array are skipped entirely.
   */
  filter?:
    ((name: string, info?: AssetInfo) => boolean | undefined) | undefined;
  /**
   * the languages this minimizer minifies, e.g. `["css"]`. Source that carries no filename — what a module embeds in another language's output — is dispatched by this rather than by `test` / `filter`, and a minimizer that declares nothing is never handed any
   */
  getTypes?: (() => string[] | undefined) | undefined;
  /**
   * the languages this minimizer can hand out from inside what it minifies, through the `renderEmbeddedSource` option. Empty (or absent) means it nests nothing a caller can reach, and the option is not passed
   */
  getEmbeddedTypes?:
    ((minimizerOptions?: EXPECTED_OBJECT) => string[] | undefined) | undefined;
  /**
   * which `processAssets` stage this minimizer has to run in, named off the `Compilation` it is handed — compressing reads the bytes a user downloads, so it asks for `PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER`. Each runs where it asks, chaining through the asset a later pass reads back, and one asking for nothing runs where minifying belongs — after the bundle is rendered and before its hashes are taken
   */
  getStage?:
    | ((
        compilation: typeof import("webpack").Compilation,
      ) => number | undefined)
    | undefined;
  /**
   * the name this function's work goes under in the asset's info, which is what the asset it wrote is marked with and what stats print. `compress` says `compressed`, another encoding of the bytes being no smaller a version of them; a minimizer saying nothing minified the asset, so `minimized`, and a generator saying nothing wrote a new file, so `generated`. It is also what is not run twice: an asset already marked with every name a function writes is declined, which is how a minified asset a child compilation handed up is left alone
   */
  getAssetFlag?: (() => string | undefined) | undefined;
};
type MinimizerImplementation<T> = T extends EXPECTED_ANY[]
  ? {
      [P in keyof T]: BasicMinimizerImplementation<T[P]> &
        MinimizeFunctionHelpers;
    }
  : BasicMinimizerImplementation<T> & MinimizeFunctionHelpers;
type InternalOptions<T> = {
  /**
   * name
   */
  name: string;
  /**
   * input — bytes for a minimizer that declares `supportsBinary`
   */
  input: string | Buffer;
  /**
   * input source map
   */
  inputSourceMap: RawSourceMap | undefined;
  /**
   * extract comments option
   */
  extractComments: ExtractCommentsOptions | undefined;
  /**
   * minimizer
   */
  minimizer: {
    implementation: MinimizerImplementation<T>;
    options: MinimizerOptions<T>;
  };
  /**
   * every configured minimizer, for source one language embeds in another: it carries no filename, so `minimizer` — which holds only what this asset's name matched — is not the set to dispatch it across. `claims` is the languages each minifies and `offers` the languages each can hand out, both as data and both parallel to `implementation`, since a minify function reaches a worker as source and carries none of its properties; `at` says which of them `minimizer` holds. Absent when no nested language is reachable at all
   */
  embedded?:
    | {
        implementation: MinimizerImplementation<T>;
        options: MinimizerOptions<T>;
        claims: string[][];
        offers: string[][];
        at: number[];
      }
    | undefined;
  /**
   * true when code is a EC module, otherwise false
   */
  module?: boolean | undefined;
  /**
   * ecma version
   */
  ecma?: (number | string) | undefined;
};
type MinimizerWorker<T> = JestWorker & {
  transform: (options: string) => Promise<MinimizedResult>;
  minify: (options: InternalOptions<T>) => Promise<MinimizedResult>;
};
type Parallel = undefined | boolean | number;
/**
 * One generator, written as an object stating how to run it.
 */
type GeneratorDescriptor = {
  /**
   * the generator itself
   */
  implementation: MinimizerImplementation<EXPECTED_ANY>;
  /**
   * options for this generator, preferred over the deprecated `generatorOptions`
   */
  options?: MinimizerOptions<EXPECTED_ANY> | undefined;
  /**
   * `import` re-encodes a module as it is built, so the import that asked for it is renamed with it; `asset` writes a new file beside one already emitted
   */
  type?: ("import" | "asset") | undefined;
  /**
   * name for the generated asset, as a webpack filename template. `asset` generators only
   */
  filename?: string | undefined;
  /**
   * decides per asset whether to generate from it, on top of `test`/`include`/`exclude`
   */
  filter?: ((name: string) => boolean) | undefined;
  /**
   * removes the asset generated from. `asset` generators only
   */
  deleteOriginalAssets?: boolean | undefined;
  /**
   * generate only from assets larger than this, in bytes. `asset` generators only
   */
  threshold?: number | undefined;
  /**
   * keep the generated asset only when it is this much smaller than the one it was read from. `asset` generators only
   */
  minRatio?: number | undefined;
  /**
   * the key the generated asset is recorded under in the original's `related` info. `asset` generators only
   */
  relatedName?: (string | false) | undefined;
};
/**
 * What `generate` may be written as: one generator, a list of them, a
 * descriptor, or an object naming descriptors an asset asks for with `?as=`.
 */
type Generate =
  | MinimizerImplementation<EXPECTED_ANY>
  | MinimizerImplementation<EXPECTED_ANY>[]
  | GeneratorDescriptor
  | {
      [preset: string]:
        | MinimizerImplementation<EXPECTED_ANY>
        | MinimizerImplementation<EXPECTED_ANY>[]
        | GeneratorDescriptor;
    };
type BasePluginOptions = {
  /**
   * test rule
   */
  test?: Rules | undefined;
  /**
   * include rile
   */
  include?: Rules | undefined;
  /**
   * exclude rule
   */
  exclude?: Rules | undefined;
  /**
   * extract comments options
   */
  extractComments?: ExtractCommentsOptions | undefined;
  /**
   * parallel option
   */
  parallel?: Parallel | undefined;
  /**
   * rewrites a module's own bytes as it is built, so a re-encoding can rename the asset, or writes a new file beside one already emitted
   */
  generate?: Generate | undefined;
  /**
   * options for `generate`
   */
  generatorOptions?: MinimizerOptions<EXPECTED_ANY> | undefined;
};
type DefinedDefaultMinimizerAndOptions<T> =
  T extends import("terser").MinifyOptions
    ? {
        minify?: MinimizerImplementation<T> | undefined;
        minimizerOptions?: MinimizerOptions<T> | undefined;
        terserOptions?: MinimizerOptions<T> | undefined;
      }
    : {
        minify: MinimizerImplementation<T>;
        minimizerOptions?: MinimizerOptions<T> | undefined;
        terserOptions?: MinimizerOptions<T> | undefined;
      };
type InternalPluginOptions<T> = BasePluginOptions & {
  minimizer: {
    implementation: MinimizerImplementation<T>;
    options: MinimizerOptions<T>;
    filters?: (
      ((name: string, info: AssetInfo) => boolean | undefined) | undefined
    )[];
  };
  generator?: {
    implementation: MinimizerImplementation<T>;
    options: MinimizerOptions<T>;
  };
};
