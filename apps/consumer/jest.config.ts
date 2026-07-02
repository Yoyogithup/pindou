import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/dist/"],
  moduleNameMapper: {
    "^@tests/(.*)$": "<rootDir>/tests/$1",
    "^@/features/generator/core/canvasAdapter$": "<rootDir>/src/features/generator/core/canvasAdapter.node.ts",
    "^\\./canvasAdapter$": "<rootDir>/src/features/generator/core/canvasAdapter.node.ts",
  },
};

export default createJestConfig(config);
