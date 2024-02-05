const config = {
  testEnvironment: "node",
  displayName: "experimental-high-embedding",
  extensionsToTreatAsEsm: ['.ts'],

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", {  useESM: true }],
  },
};

export default config;
