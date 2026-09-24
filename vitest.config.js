module.exports = {
  test: {
    include: [
      "packages/**/src/__tests__/**/*.test.ts",
      "apps/**/src/__tests__/**/*.test.ts"
    ],
    exclude: [
      "**/node_modules/**",
      "**/e2e/**"
    ],
    globals: true
  }
};
