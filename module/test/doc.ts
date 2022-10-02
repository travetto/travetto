import { d, lib, mod } from '@travetto/doc';
import { ModuleCompileCache } from '@travetto/boot/src/internal/module-cache';

import { Suite } from './src/decorator/suite';
import { Test } from './src/decorator/test';

export const text = d`
${d.Header()}

This module provides unit testing functionality that integrates with the framework. It is a declarative framework, using decorators to define tests and suites. The test produces results in the following formats:

${d.List(
  d`${lib.TAP}, default and human-readable`,
  d`${lib.JSON}, best for integrating with at a code level`,
  d`${lib.XUnit}, standard format for CI/CD systems e.g. Jenkins, Bamboo, etc.`
)}

${d.Note(d`All tests should be under the ${d.Path('test/.*')} folders.  The pattern for tests is defined as a regex and not standard globbing.`)}

${d.Section('Definition')}

A test suite is a collection of individual tests.  All test suites are classes with the ${Suite} decorator. Tests are defined as methods on the suite class, using the ${Test} decorator.  All tests intrinsically support ${d.Input('async')}/${d.Input('await')}.


A simple example would be:

${d.Code('Example Test Suite', 'doc/example.ts')}


${d.Section('Assertions')}
A common aspect of the tests themselves are the assertions that are made.  ${lib.Node} provides a built-in ${lib.Assert} library.  The framework uses AST transformations to modify the assertions to provide integration with the test module, and to provide a much higher level of detail in the failed assertions.  For example:

${d.Code('Example assertion for deep comparison', 'doc/test/assert-example.ts')}

would translate to:

${d.Code('Transpiled test Code', ModuleCompileCache.readEntry('doc/test/assert-example.ts'), false, 'doc/javascript')}

This would ultimately produce the error like:

${d.Code('Sample Validation Error', `
AssertionError(
  message="{size: 20, address: {state: 'VA' }} should deeply strictly equal {}"
)
`)}

The equivalences for all of the ${lib.Assert} operations are:

${d.List(
  d`${d.Method('assert(a == b)')} as ${d.Method('assert.equal(a, b)')}`,
  d`${d.Method('assert(a !== b)')} as ${d.Method('assert.notEqual(a, b)')}`,
  d`${d.Method('assert(a === b)')} as ${d.Method('assert.strictEqual(a, b)')}`,
  d`${d.Method('assert(a !== b)')} as ${d.Method('assert.notStrictEqual(a, b)')}`,
  d`${d.Method('assert(a >= b)')} as ${d.Method('assert.greaterThanEqual(a, b)')}`,
  d`${d.Method('assert(a > b)')} as ${d.Method('assert.greaterThan(a, b)')}`,
  d`${d.Method('assert(a <= b)')} as ${d.Method('assert.lessThanEqual(a, b)')}`,
  d`${d.Method('assert(a < b)')} as ${d.Method('assert.lessThan(a, b)')}`,
  d`${d.Method('assert(a instanceof b)')} as ${d.Method('assert.instanceOf(a, b)')}`,
  d`${d.Method('assert(a.includes(b))')} as ${d.Method('assert.ok(a.includes(b))')}`,
  d`${d.Method('assert(/a/.test(b))')} as ${d.Method('assert.ok(/a/.test(b))')}`,
)}


In addition to the standard operations, there is support for throwing/rejecting errors (or the inverse).  This is useful for testing error states or ensuring errors do not occur.

${d.List(
  d`${d.Method('throws')}/${d.Method('doesNotThrow')} is for catching synchronous rejections
  ${d.Code('Throws vs Does Not Throw', 'doc/throws.ts')}
  `,
  d`${d.Method('rejects')}/${d.Method('doesNotReject')} is for catching asynchronous rejections
  ${d.Code('Rejects vs Does Not Reject', 'doc/rejects.ts')}
  `
)}

Additionally, the ${d.Method('throws')}/${d.Method('rejects')} assertions take in a secondary parameter to allow for specification of the type of error expected.  This can be:
${d.List(
  "A regular expression or string to match against the error's message",
  'A class to ensure the returned error is an instance of the class passed in',
  'A function to allow for whatever custom verification of the error is needed',
)}

${d.Code('Example of different Error matching paradigms', 'doc/error-types.ts')}

${d.Section('Running Tests')}

To run the tests you can either call the ${mod.Cli} by invoking

${d.Execute('Test Help Output', 'trv', ['test', '--help'])}

The regexes are the patterns of tests you want to run, and all tests must be found under the ${d.Path('test/')} folder.

${d.SubSection('Travetto Plugin')}

The ${lib.TravettoPlugin} also supports test running,  which will provide even more functionality for real-time testing and debugging.

${d.Section('Additional Considerations')}
During the test execution, a few things additionally happen that should be helpful.  The primary addition, is that all console output is captured, and will be exposed in the test output.  This allows for investigation at a later point in time by analyzing the output.

Like output, all promises are also intercepted.  This allows the code to ensure that all promises have been resolved before completing the test.  Any uncompleted promises will automatically trigger an error state and fail the test.
`;
