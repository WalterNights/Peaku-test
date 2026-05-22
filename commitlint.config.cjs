module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'subject-case': [2, 'never', ['upper-case']],
    'scope-enum': [
      1,
      'always',
      ['auth', 'products', 'gateway', 'frontend', 'shared', 'infra', 'docs', 'deps'],
    ],
  },
};
