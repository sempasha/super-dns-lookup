import { run } from 'node:test';
import { spec } from 'node:test/reporters';

const testStream = run({
  cwd: __dirname,
  globPatterns: ['./tests/**/*.spec.ts'],
  isolation: 'none',
  coverageIncludeGlobs: './lib/**/*.ts',
  branchCoverage: 100,
  functionCoverage: 100,
  lineCoverage: 100
});

testStream.compose(spec).pipe(process.stdout);
