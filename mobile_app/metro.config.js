const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedPackageRoot = path.resolve(workspaceRoot, 'packages/shared');

const config = getDefaultConfig(projectRoot);

// Watch shared source only — not the whole repo (avoids duplicate hoisted packages).
config.watchFolders = [sharedPackageRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Pin React to the single hoisted 19.1.0 install (must match react-native-renderer).
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
};

module.exports = config;
