import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: ['dist', 'test/hbConfig', '.github'],
    typescript: true,
    react: false,
  },
  {
    files: ['**/*.?([cm])[jt]s?(x)'],
    rules: {
      'curly': ['error', 'all'],
      'style/brace-style': ['error', '1tbs'],
      'style/quote-props': ['error', 'consistent-as-needed'],
      'antfu/if-newline': 'off',
      'no-console': 'off',
      'node/prefer-global/process': 'off',
    },
  },
)
