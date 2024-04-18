import dotenv from "dotenv";

import * as path from "path";
import * as fs from "fs";

function findRootDir(currentDir) {
  // Check if a tsconfig.json file exists in the current directory
  const tsconfigPath = path.join(currentDir, "tsconfig-base.json");
  if (fs.existsSync(tsconfigPath)) {
    return currentDir;
  }

  // If not, go up one level
  const parentDir = path.dirname(currentDir);

  // Check if we have reached the root directory
  if (parentDir === currentDir) {
    return null; // Root not found
  }

  // Recursive call to find root directory in the parent directory
  return findRootDir(parentDir);
}

// Get the root directory of the TypeScript project
const rootDir = findRootDir(process.cwd());

if (!rootDir) {
  console.log(`Unable to find the root directory of the TypeScript project`);
}

const packageDir = `${rootDir}/packages/runtime/lifecycle`;

const moduleNameMapper = {
  "^(\\.{1,2}/.*)\\.js$": "$1",
};

dotenv.config({ path: `${rootDir}/env/.env.test` });

const config = {
  testEnvironment: "node",
  displayName: "Runtime Lifecycle e2e Test",
  extensionsToTreatAsEsm: [".ts"],
  testRegex: ".*e2e.spec.ts$",
  modulePaths: [packageDir],
  moduleNameMapper,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: `${packageDir}/test/tsconfig.json`, useESM: true, isolatedModules: true }],
  },
};

export default config;
