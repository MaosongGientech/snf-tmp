/** @type {import("prettier").Config} */
const config = {
  semi: false,
  trailingComma: "es5",
  singleQuote: false,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  endOfLine: "lf",
  // Space Rules
  plugins: ["prettier-plugin-zh"],
  spaceAroundAlphabet: true,
  spaceAroundNumber: true,
  noSpaceBetweenNumberUnit: ["%", "°C", "°"],
}

export default config
