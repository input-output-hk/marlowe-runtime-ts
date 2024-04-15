import * as t from "io-ts/lib/index.js";
import { readFile } from "fs/promises";
import * as fs from "fs";
import * as path from "path";
import { formatValidationErrors } from "jsonbigint-io-ts-reporters";

const lucidNetworkGuard = t.union([
  t.literal("Mainnet"),
  t.literal("Preview"),
  t.literal("Preprod"),
  t.literal("Custom"),
]);

export const testConfigurationGuard = t.type({
  bank: t.type({ seedPhrase: t.string }),
  lucid: t.type({
    blockfrostProjectId: t.string,
    blockfrostUrl: t.string,
  }),
  network: lucidNetworkGuard,
  runtimeURL: t.string,
});

export type TestConfiguration = t.TypeOf<typeof testConfigurationGuard>;

function findRootDir(currentDir: string): string | null {
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
/**
 * Read Test Configurations from an env file
 * @returns
 */
export async function readTestConfiguration(
  filepath?: string
): Promise<TestConfiguration> {
  if (!filepath) {
    filepath = `${rootDir}/env/.test-env.json`;
  }
  const configStr = await readFile(filepath, { encoding: "utf-8" });
  const result = testConfigurationGuard.decode(JSON.parse(configStr));
  if (result._tag === "Left") {
    throw new Error(
      `Invalid configuration: ${formatValidationErrors(result.left)}`
    );
  }
  return result.right;
}
