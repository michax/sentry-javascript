/*
  This script prepares the central `build` directory for NPM package creation.
  It first copies all non-code files into the `build` directory, including `package.json`, which
  is edited to adjust entry point paths. These corrections are performed so that the paths align with
  the directory structure inside `build`.
*/

import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';

const NPM_BUILD_DIR = 'build/npm';
const ASSETS = ['README.md', 'LICENSE', 'package.json', '.npmignore'];
const ENTRY_POINTS = ['main', 'module', 'types'];

// check if build dirs exists
if (!fs.existsSync(path.resolve(NPM_BUILD_DIR))) {
  console.error(`Directory ${NPM_BUILD_DIR} DOES NOT exist`);
  console.error("This script should only be executed after you've run `yarn build`.");
  process.exit(1);
}

// copy non-code assets to build dir
ASSETS.forEach(asset => {
  const assetPath = path.resolve(asset);
  if (!fs.existsSync(assetPath)) {
    console.error(`Asset ${asset} does not exist.`);
    process.exit(1);
  }
  fs.copyFileSync(asset, path.resolve(NPM_BUILD_DIR, asset));
});

// TODO remove in v7! Until then:
// copy CDN bundles into npm dir to temporarily keep bundles in npm tarball
// inside the tarball, they are located in `build/`
// for now, copy it by default, unless explicitly forbidden via an command line arg
const tmpCopyBundles = !process.argv.includes('-skipBundleCopy');
if (tmpCopyBundles) {
  const npmTmpBundlesPath = path.resolve(NPM_BUILD_DIR, 'build');
  const cdnBundlesPaht = path.resolve('build', 'bundles');
  if (!fs.existsSync(npmTmpBundlesPath)) {
    fs.mkdirSync(npmTmpBundlesPath);
  }
  fse.copy(cdnBundlesPaht, npmTmpBundlesPath);
}
// end remove

// package.json modifications
const packageJsonPath = path.resolve(NPM_BUILD_DIR, 'package.json');
const pkgJson: { [key: string]: string } = require(packageJsonPath);

// modify entry points to point to correct paths (i.e. strip out the build directory)
ENTRY_POINTS.filter(entryPoint => pkgJson[entryPoint]).forEach(entryPoint => {
  pkgJson[entryPoint] = pkgJson[entryPoint].replace(`${NPM_BUILD_DIR}/`, '');
});

// TODO decide if we want this:
delete pkgJson.scripts;
delete pkgJson.volta;
delete pkgJson.jest;

// write modified package.json to file (pretty-printed with 2 spaces)
fs.writeFileSync(packageJsonPath, JSON.stringify(pkgJson, null, 2));

console.log(`\nSuccessfully finished postbuild commands for ${pkgJson.name}`);
