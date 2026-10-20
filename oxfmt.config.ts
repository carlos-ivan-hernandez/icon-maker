import {defineConfig} from 'oxfmt';

export default defineConfig({
  arrowParens: 'avoid',
  bracketSameLine: false,
  bracketSpacing: false,
  endOfLine: 'lf',
  insertFinalNewline: true,
  jsxSingleQuote: true,
  printWidth: 120,
  semi: true,
  singleAttributePerLine: true,
  singleQuote: true,
  sortImports: {
    newlinesBetween: false,
  },
  sortPackageJson: {
    sortScripts: true,
  },
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
});
