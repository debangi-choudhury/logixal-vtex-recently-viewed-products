// Two projects: the Node service, and the React pages in a browser-like
// environment. VTEX IO modules (vtex.*) only exist inside the store runtime,
// so React tests use the stand-ins in react/__tests__/support.
const tsJest = [
  'ts-jest',
  {
    diagnostics: false,
    tsconfig: {
      module: 'commonjs',
      esModuleInterop: true,
      jsx: 'react',
      target: 'es2019',
    },
  },
]

const support = '<rootDir>/react/__tests__/support'

module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/node/__tests__/**/*.test.ts'],
      transform: { '^.+\\.ts$': tsJest },
      modulePathIgnorePatterns: [
        '<rootDir>/node/package.json',
        '<rootDir>/react/package.json',
      ],
    },
    {
      displayName: 'react',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/react/__tests__/**/*.test.{ts,tsx}'],
      transform: {
        '^.+\\.tsx?$': tsJest,
        '^.+\\.gql$': `${support}/graphqlTransform.js`,
      },
      moduleNameMapper: { '^(vtex\\.[^/]+)(/.*)?$': `${support}/$1$2` },
      modulePathIgnorePatterns: [
        '<rootDir>/node/package.json',
        '<rootDir>/react/package.json',
      ],
    },
  ],
  collectCoverageFrom: [
    'node/**/*.ts',
    'react/**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/typings/**',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 70, functions: 80, lines: 80 },
  },
}
