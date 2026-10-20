import {defineConfig} from 'oxlint';

export default defineConfig({
  ignorePatterns: ['dist/**'],
  plugins: ['eslint', 'import', 'oxc', 'react', 'react-perf', 'typescript', 'unicorn'],
  categories: {
    correctness: 'error',
    suspicious: 'warn',
    perf: 'warn',
  },
  env: {
    browser: true,
  },
  settings: {
    react: {
      version: '19',
    },
  },
  options: {
    typeAware: true,
  },
  rules: {
    'eslint/no-duplicate-imports': 'warn',
    'import/no-unassigned-import': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-perf/jsx-no-jsx-as-prop': 'off',
    'react-perf/jsx-no-new-array-as-prop': 'off',
    'react-perf/jsx-no-new-function-as-prop': 'off',
    'react-perf/jsx-no-new-object-as-prop': 'off',
    'typescript/consistent-return': 'off',
    'typescript/consistent-type-imports': ['warn', {fixStyle: 'inline-type-imports'}],
  },
});
