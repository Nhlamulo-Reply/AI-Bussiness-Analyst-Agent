module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/dist/tests/**/*.test.js"],
  collectCoverageFrom: ["dist/src/**/*.js"],
  coverageDirectory: "coverage"
};
