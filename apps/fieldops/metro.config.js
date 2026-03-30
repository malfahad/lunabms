const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// sql.js package.json sets "browser" to sql-wasm-browser.js, which loads
// sql-wasm-browser.wasm. That artifact is not published at sql.js.org/dist (404),
// so initSqlJs fails with "both async and sync fetching of the wasm failed".
// The main dist/sql-wasm.js build loads sql-wasm.wasm, which the CDN hosts.
let sqlJsMainPath;
try {
  sqlJsMainPath = require.resolve("sql.js/dist/sql-wasm.js", {
    paths: [projectRoot, workspaceRoot],
  });
} catch {
  sqlJsMainPath = path.join(workspaceRoot, "node_modules/sql.js/dist/sql-wasm.js");
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "sql.js" && platform === "web") {
    return { filePath: sqlJsMainPath, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
