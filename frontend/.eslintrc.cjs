module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // 0G client service wrappers.
      files: ['src/services/0g-*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    {
      // Pairing a provider with its consumer hook, and a component with its style
      // helper, are deliberate. Both only cost Fast Refresh granularity in dev.
      files: [
        'src/contexts/**/*.tsx',
        'src/components/ui/Button.tsx',
        'src/components/loans/LoanCard.tsx',
      ],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
