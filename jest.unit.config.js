module.exports = {
  testEnvironment: "node",
  projects: [
    "<rootDir>/packages/language/core/v1/test/jest.unit.config.mjs",
    "<rootDir>/packages/language/examples/test/jest.unit.config.mjs",
    "<rootDir>/packages/marlowe-object/test/jest.unit.config.mjs",
    "<rootDir>/packages/experimental-high-embedding/test/jest.unit.config.mjs",
    "<rootDir>/packages/wallet/test/jest.unit.config.mjs",
  ],
};
