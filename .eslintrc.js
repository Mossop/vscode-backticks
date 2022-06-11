module.exports = {
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },

  ignorePatterns: ["node_modules", ".vscode-test", "dist", "out", "test_files"],

  extends: [require.resolve("@mossop/config/vscode-ts/eslintrc")],

  rules: {
    "no-console": "off",
    "default-case": "off",
    "no-await-in-loop": "off",
    "no-param-reassign": ["error", { props: false }],
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: ["**/*.js", "src/test/**/*"],
      },
    ],
  },
};
