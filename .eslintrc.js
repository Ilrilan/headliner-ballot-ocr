module.exports = {
  ignorePatterns: [
    'node_modules',
  ],
  parserOptions: {
    ecmaVersion: 2017
  },
  env: {
    es6: true,
    node: true,
  },
  plugins: [
    'import',
    'filenames',
  ],
  extends: [
    'prettier',
  ],
  rules: {
    // https://eslint.org/docs/rules/
    curly: 'error',
    'keyword-spacing': 'error',
    'max-params': ['error', 8], // service-caller может работать с восемью аргументами
    'no-console': 'error',
    'no-unused-vars': ['error', { vars: 'all', args: 'none', ignoreRestSiblings: true }],
    'no-restricted-imports': ['error', 'prop-types'],
    'object-curly-spacing': ['error', 'always'],
    semi: ['error', 'never'],
    'space-before-blocks': 'error',
    // https://github.com/benmosher/eslint-plugin-import
    'import/extensions': ['error', 'never', { css: 'always', json: 'always', svg: 'always' }],
    'import/prefer-default-export': 'off'
  },
}
