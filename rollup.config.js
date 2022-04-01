/* eslint-disable max-lines */
/**
 * Code for generating config used by individual packages' Rollup configs
 *
 * Rollup config docs: https://rollupjs.org/guide/en/#big-list-of-options
 *
 * License plugin docs: https://github.com/mjeanroy/rollup-plugin-license
 * Regex Replace plugin docs: https://github.com/jetiny/rollup-plugin-re
 * Replace plugin docs: https://github.com/rollup/plugins/tree/master/packages/replace
 * Resolve plugin docs: https://github.com/rollup/plugins/tree/master/packages/node-resolve
 * Sucrase plugin docs: https://github.com/rollup/plugins/tree/master/packages/sucrase
 * Terser plugin docs: https://github.com/TrySound/rollup-plugin-terser#options
 * Terser docs: https://github.com/terser/terser#api-reference
 * Typescript plugin docs: https://github.com/ezolenko/rollup-plugin-typescript2
 *
 */

import assert from 'assert';
import { builtinModules } from 'module';
import * as path from 'path';

import deepMerge from 'deepmerge';
import license from 'rollup-plugin-license';
import resolve from '@rollup/plugin-node-resolve';
import regexReplace from 'rollup-plugin-re';
import replace from '@rollup/plugin-replace';
import sucrase from '@rollup/plugin-sucrase';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

Error.stackTraceLimit = Infinity;

const packageDotJSON = require(path.resolve(process.cwd(), './package.json'));

/**
 * Helper functions to compensate for the fact that JS can't handle negative array indices very well
 *
 * TODO `insertAt` is only exported so the integrations config can inject the `commonjs` plugin, for localforage (used
 * in the offline plugin). Once that's fixed to no longer be necessary, this can stop being exported.
 */
const getLastElement = array => {
  return array[array.length - 1];
};
export const insertAt = (arr, index, ...insertees) => {
  const newArr = [...arr];
  // Add 1 to the array length so that the inserted element ends up in the right spot with respect to the length of the
  // new array (which will be one element longer), rather than that of the current array
  const destinationIndex = index >= 0 ? index : arr.length + 1 + index;
  newArr.splice(destinationIndex, 0, ...insertees);
  return newArr;
};

const nodeResolvePlugin = resolve();

/**
 * Create a plugin to add an identification banner to the top of stand-alone bundles.
 *
 * @param title The title to use for the SDK, if not the package name
 * @returns An instance of the `rollup-plugin-license` plugin
 */
function makeLicensePlugin(title) {
  const commitHash = require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  return license({
    banner: {
      content: `/*! <%= data.title %> <%= pkg.version %> (${commitHash}) | https://github.com/getsentry/sentry-javascript */`,
      data: { title },
    },
  });
}

function makeIsDebugBuildPlugin(includeDebugging) {
  return replace({
    // don't turn `const __SENTRY_DEBUG__ = false` into `const false = false`
    preventAssignment: true,
    // everywhere else, replace it with the value of `includeDebugging`
    values: {
      __SENTRY_DEBUG__: includeDebugging,
    },
  });
}

// `terser` options reference: https://github.com/terser/terser#api-reference
// `rollup-plugin-terser` options reference: https://github.com/TrySound/rollup-plugin-terser#options
export const terserPlugin = terser({
  mangle: {
    // captureExceptions and captureMessage are public API methods and they don't need to be listed here
    // as mangler doesn't touch user-facing thing, however sentryWrapped is not, and it would be mangled into a minified version.
    // We need those full names to correctly detect our internal frames for stripping.
    // I listed all of them here just for the clarity sake, as they are all used in the frames manipulation process.
    reserved: ['captureException', 'captureMessage', 'sentryWrapped'],
    properties: {
      regex: /^_[^_]/,
      reserved: ['_experiments'],
    },
  },
  output: {
    comments: false,
  },
});

export function makeBaseBundleConfig(options) {
  const { input, isAddOn, jsVersion, licenseTitle, outputFileBase } = options;

  const baseTSPluginOptions = {
    tsconfig: 'tsconfig.esm.json',
    tsconfigOverride: {
      compilerOptions: {
        declaration: false,
        declarationMap: false,
        paths: {
          '@sentry/browser': ['../browser/src'],
          '@sentry/core': ['../core/src'],
          '@sentry/hub': ['../hub/src'],
          '@sentry/minimal': ['../minimal/src'],
          '@sentry/types': ['../types/src'],
          '@sentry/utils': ['../utils/src'],
        },
        baseUrl: '.',
      },
    },
    include: ['*.ts+(|x)', '**/*.ts+(|x)', '../**/*.ts+(|x)'],
    // the typescript plugin doesn't handle concurrency very well, so clean the cache between builds
    // (see https://github.com/ezolenko/rollup-plugin-typescript2/issues/15)
    clean: true,
    // TODO: For the moment, the above issue seems to have stopped spamming the build with (non-blocking) errors, as it
    // was originally. If it starts again, this will suppress that output. If we get to the end of the bundle revamp and
    // it still seems okay, we can take this out entirely.
    // verbosity: 0,
  };

  const typescriptPluginES5 = typescript(
    deepMerge(baseTSPluginOptions, {
      tsconfigOverride: {
        compilerOptions: {
          target: 'es5',
        },
      },
    }),
  );

  const typescriptPluginES6 = typescript(
    deepMerge(baseTSPluginOptions, {
      tsconfigOverride: {
        compilerOptions: {
          target: 'es6',
        },
      },
    }),
  );

  const markAsBrowserBuildPlugin = replace({
    // don't replace `__placeholder__` where it's followed immediately by a single `=` (to prevent ending up
    // with something of the form `let "replacementValue" = "some assigned value"`, which would cause a
    // syntax error)
    preventAssignment: true,
    // the replacement to make
    values: {
      __SENTRY_BROWSER_BUNDLE__: true,
    },
  });

  const licensePlugin = makeLicensePlugin(licenseTitle);

  // used by `@sentry/browser`, `@sentry/tracing`, and `@sentry/vue` (bundles which are a full SDK in and of themselves)
  const standAloneBundleConfig = {
    output: {
      format: 'iife',
      name: 'Sentry',
    },
    context: 'window',
  };

  // used by `@sentry/integrations` and `@sentry/wasm` (bundles which need to be combined with a stand-alone SDK bundle)
  const addOnBundleConfig = {
    // These output settings are designed to mimic an IIFE. We don't use Rollup's `iife` format because we don't want to
    // attach this code to a new global variable, but rather inject it into the existing SDK's `Integrations` object.
    output: {
      format: 'cjs',

      // code to add before the CJS wrapper
      banner: '(function (__window) {',

      // code to add just inside the CJS wrapper, before any of the wrapped code
      intro: 'var exports = {};',

      // code to add after all of the wrapped code, but still inside the CJS wrapper
      outro: () =>
        [
          '',
          "  // Add this module's exports to the global `Sentry.Integrations`",
          '  __window.Sentry = __window.Sentry || {};',
          '  __window.Sentry.Integrations = __window.Sentry.Integrations || {};',
          '  for (var key in exports) {',
          '    if (Object.prototype.hasOwnProperty.call(exports, key)) {',
          '      __window.Sentry.Integrations[key] = exports[key];',
          '    }',
          '  }',
        ].join('\n'),

      // code to add after the CJS wrapper
      footer: '}(window));',
    },
  };

  // used by all bundles
  const sharedBundleConfig = {
    input,
    output: {
      // a file extension will be added to this base value when we specify either a minified or non-minified build
      file: `build/${outputFileBase}`,
      sourcemap: true,
      strict: false,
      esModule: false,
    },
    plugins: [
      jsVersion.toLowerCase() === 'es5' ? typescriptPluginES5 : typescriptPluginES6,
      markAsBrowserBuildPlugin,
      nodeResolvePlugin,
      licensePlugin,
    ],
    treeshake: 'smallest',
  };

  return deepMerge(sharedBundleConfig, isAddOn ? addOnBundleConfig : standAloneBundleConfig);
}

/**
 * Takes the CDN rollup config for a given package and produces three versions of it:
 *   - non-minified, including debug logging,
 *   - minified, including debug logging,
 *   - minified, with debug logging stripped
 *
 * @param baseConfig The rollup config shared by the entire package
 * @returns An array of versions of that config
 */
export function makeBundleConfigVariants(baseConfig) {
  const { plugins } = baseConfig;
  const includeDebuggingPlugin = makeIsDebugBuildPlugin(true);
  const stripDebuggingPlugin = makeIsDebugBuildPlugin(false);

  // The license plugin has to be last, so it ends up after terser. Otherwise, terser will remove the license banner.
  assert(
    getLastElement(plugins).name === 'rollup-plugin-license',
    `Last plugin in given options should be \`rollup-plugin-license\`. Found ${getLastElement(plugins).name}`,
  );

  // The additional options to use for each variant we're going to create
  const variantSpecificConfigs = [
    {
      output: {
        file: `${baseConfig.output.file}.js`,
      },
      plugins: insertAt(plugins, -2, includeDebuggingPlugin),
    },
    // This variant isn't particularly helpful for an SDK user, as it strips logging while making no other minification
    // changes, so by default we don't create it. It is however very useful when debugging rollup's treeshaking, so it's
    // left here for that purpose.
    // {
    //   output: { file: `${baseConfig.output.file}.no-debug.js`,
    //   },
    //   plugins: insertAt(plugins, -2, stripDebuggingPlugin),
    // },
    {
      output: {
        file: `${baseConfig.output.file}.min.js`,
      },
      plugins: insertAt(plugins, -2, stripDebuggingPlugin, terserPlugin),
    },
    {
      output: {
        file: `${baseConfig.output.file}.debug.min.js`,
      },
      plugins: insertAt(plugins, -2, includeDebuggingPlugin, terserPlugin),
    },
  ];

  return variantSpecificConfigs.map(variant =>
    deepMerge(baseConfig, variant, {
      // this makes it so that instead of concatenating the `plugin` properties of the two objects, the first value is
      // just overwritten by the second value
      arrayMerge: (first, second) => second,
    }),
  );
}

export function makeBaseNPMConfig(options = {}) {
  const { entrypoint, esModuleInterop } = options;

  const sucrasePlugin = sucrase({
    transforms: ['typescript'],
  });

  const constToVarPlugin = regexReplace({
    patterns: [
      {
        test: 'const ',
        replace: 'var ',
      },
    ],
  });

  return {
    input: entrypoint || 'src/index.ts',
    output: {
      sourcemap: true,
      // output individual files rather than one big bundle
      preserveModules: true,
      // any wrappers or helper functions generated by rollup can use ES6 features
      generatedCode: 'es2015',
      // don't add `"use strict"` to the top of cjs files
      strict: false,
      // do TS-3.8-style exports
      //     exports.dogs = are.great
      // rather than TS-3.9-style exports
      //     Object.defineProperty(exports, 'dogs', {
      //       enumerable: true,
      //       get: () => are.great,
      //     });
      externalLiveBindings: false,
      // Equivalent to `esModuleInterop` in tsconfig.
      // Controls whether rollup emits helpers to handle special cases where turning
      //     `import * as dogs from 'dogs'`
      // into
      //     `const dogs = require('dogs')`
      // doesn't work.
      //
      // `auto` -> emit helpers
      // `esModule` -> don't emit helpers
      interop: esModuleInterop ? 'auto' : 'esModule',
    },
    plugins: [nodeResolvePlugin, sucrasePlugin, constToVarPlugin],
    // don't include imported modules from outside the package in the final output
    external: [
      ...builtinModules,
      ...Object.keys(packageDotJSON.dependencies || {}),
      ...Object.keys(packageDotJSON.devDependencies || {}),
      ...Object.keys(packageDotJSON.peerDependencies || {}),
    ],

    // TODO `'smallest'` will get rid of `isDebugBuild()` by evaluating it and inlining the result and then treeshaking
    // from there. The current setting (false) prevents this, in case we want to leave it there for users to use in
    // their own bundling. That said, we don't yet know for sure that that works, so come back to this.
    // treeshake: 'smallest',
    treeshake: false,
  };
}

export function makeNPMConfigVariants(baseConfig) {
  const variantSpecificConfigs = [
    // TODO change dist to cjs
    { output: { format: 'cjs', dir: 'build/dist' } },
    { output: { format: 'esm', dir: 'build/esm' } },
  ];

  return variantSpecificConfigs.map(variant => deepMerge(baseConfig, variant));
}
