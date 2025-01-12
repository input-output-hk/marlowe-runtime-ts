import { generateSeedPhrase } from "../index.js";
import { MarloweJSON } from "@marlowe.io/adapter/codec";

const log = console.log.bind(console);
/**
 * Little Executable to generate randomly a new 24-words seed phrase for creating a new wallet.
 */
async function main() {
  generateSeedPhrase("24-words");
  log(` * Generating a new 24-words seed phrase :`);
  log(MarloweJSON.stringify(generateSeedPhrase("24-words"), null, 4));
  log("Done.🎉");
}

await main();
