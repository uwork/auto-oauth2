module.exports = {
  roots: ['<rootDir>/lib'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }]
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
}
