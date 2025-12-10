import js from "@eslint/js"
import { defineConfig } from "eslint/config"
import eslintConfigPrettier from "eslint-config-prettier"
import prettierPlugin from "eslint-plugin-prettier"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import turboPlugin from "eslint-plugin-turbo"
import unusedImports from "eslint-plugin-unused-imports"
import tseslint from "typescript-eslint"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = defineConfig([
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      prettier: prettierPlugin,
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "prettier/prettier": "error",

      // unused vars
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // import groups and sort
      "unused-imports/no-unused-imports": "error",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^react", "^react/.*"],
            ["^next", "^next/.*"],
            ["^@?\\w"],
            ["^@surge"],
            ["^@"],
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
            ["^.+\\.css$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",

      // padding line between statements
      "padding-line-between-statements": [
        "error",
        // Always require blank line after import statements
        { blankLine: "always", prev: "import", next: "*" },
        // Allow any blank lines between import statements (handled by simple-import-sort)
        { blankLine: "any", prev: "import", next: "import" },
      ],
    },
  },
  {
    ignores: ["dist/**", ".vscode/**"],
  },
])
