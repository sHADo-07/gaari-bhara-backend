// ESLint 9 "flat" config (the old .eslintrc.js is not read by ESLint 9).
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths";

export default [
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "uploads/**"] },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "no-relative-import-paths": noRelativeImportPaths,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-function": "warn",
      eqeqeq: "warn",
      // Use "@/modules/..." style imports inside src (tests may use relative paths)
      "no-relative-import-paths/no-relative-import-paths": ["warn", { rootDir: "src", prefix: "@" }],
    },
  },
  {
    // tests import the code with relative paths on purpose
    files: ["test/**/*.ts"],
    rules: { "no-relative-import-paths/no-relative-import-paths": "off" },
  },
];
