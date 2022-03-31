import { makeBaseBundleConfig, makeBundleConfigVariants } from '../../rollup.config';

const baseBundleConfig = makeBaseBundleConfig({
  input: 'src/index.ts',
  isAddOn: true,
  jsVersion: 'es5',
  licenseTitle: '@sentry/wasm',
  outputFileBase: 'wasm',
});

export default makeBundleConfigVariants(baseBundleConfig);
