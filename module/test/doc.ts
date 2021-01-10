import { doc as d, lib, mod, List, Note, pth, Section, inp, Code, meth, Execute, SubSection } from '@travetto/doc';
import { AppCache } from '@travetto/boot';

import { Suite } from './src/decorator/suite';
import { Test } from './src/decorator/test';

exports.text = d`

This module provides unit testing functionality that integrates with the framework. It is a declarative framework, using decorators to define tests and suites. The test produces results in the following formats:

${List(
  d`${lib.TAP}, default and human-readable`,
  d`${lib.JSON}, best for integrating with at a code level`,
  d`${lib.XUnit}, standard format for CI/CD systems e.g. Jenkins, Bamboo, etc.`
)}

${Note(d`All tests should be under the ${pth`test/.*`} folders.  The pattern for tests is defined as a regex and not standard globbing.`)}

${Section('Definition')}

A test suite is a collection of individual tests.  All test suites are classes with the ${Suite} decorator. Tests are defined as methods on the suite class, using the ${Test} decorator.  All tests intrinsically support ${inp`async`}/${inp`await`}.


A simple example would be:

${Code('Example Test Suite', 'doc/example.ts')}


${Section('Assertions')}
A common aspect of the tests themselves are the assertions that are made.  ${lib.Node} provides a built-in ${lib.Assert} library.  The framework uses AST transformations to modify the assertions to provide integration with the test module, and to provide a much higher level of detail in the failed assertions.  For example:

${Code('Example assertion for deep comparison', 'doc/test/assert-example.ts')}

would translate to:

${Code('Transpiled test Code', AppCache.readEntry('doc/test/assert-example.ts'), false, 'doc/javascript')}

This would ultimately produce the error like:

${Code('Sample Validation Error', `
AssertionError(
  message="{size: 20, address: {state: 'VA' }} should deeply strictly equal {}"
)
`)}

The equivalences for all of the ${lib.Assert} operations are:

${List(
  d`${meth`assert(a == b)`} as ${meth`assert.equal(a, b)`}`,
  d`${meth`assert(a !== b)`} as ${meth`assert.notEqual(a, b)`}`,
  d`${meth`assert(a === b)`} as ${meth`assert.strictEqual(a, b)`}`,
  d`${meth`assert(a !== b)`} as ${meth`assert.notStrictEqual(a, b)`}`,
  d`${meth`assert(a >= b)`} as ${meth`assert.greaterThanEqual(a, b)`}`,
  d`${meth`assert(a > b)`} as ${meth`assert.greaterThan(a, b)`}`,
  d`${meth`assert(a <= b)`} as ${meth`assert.lessThanEqual(a, b)`}`,
  d`${meth`assert(a < b)`} as ${meth`assert.lessThan(a, b)`}`,
  d`${meth`assert(a instanceof b)`} as ${meth`assert.instanceOf(a, b)`}`,
  d`${meth`assert(a.includes(b))`} as ${meth`assert.ok(a.includes(b))`}`,
  d`${meth`assert(/a/.test(b))`} as ${meth`assert.ok(/a/.test(b))`}`,
)}


In addition to the standard operations, there is support for throwing/rejecting errors (or the inverse).  This is useful for testing error states or ensuring errors do not occur.

${List(
  d`${meth`throws`}/${meth`doesNotThrow`} is for catching synchronous rejections
  ${Code('Throws vs Does Not Throw', 'doc/throws.ts')}
  `,
  d`${meth`rejects`}/${meth`doesNotReject`} is for catching asynchronous rejections
  ${Code('Rejects vs Does Not Reject', 'doc/rejects.ts')}
  `
)}

Additionally, the ${meth`throws`}/${meth`rejects`} assertions take in a secondary parameter to allow for specification of the type of error expected.  This can be:
${List(
  `A regular expression or string to match against the error's message`,
  `A class to ensure the returned error is an instance of the class passed in`,
  `A function to allow for whatever custom verification of the error is needed`,
)}

${Code('Example of different Error matching paradigms', 'doc/error-types.ts')}

${Section('Running Tests')}

To run the tests you can either call the ${mod.Cli} by invoking

${Execute('Test Help Output', 'travetto', ['test', '--help'])}

The regexes are the patterns of tests you want to run, and all tests must be found under the ${pth`test/`} folder.

${SubSection('Travetto Plugin')}

The ${lib.TravettoPlugin} also supports test running,  which will provide even more functionality for real-time testing and debugging.

${Section('Additional Considerations')}
During the test execution, a few things additionally happen that should be helpful.  The primary addition, is that all console output is captured, and will be exposed in the test output.  This allows for investigation at a later point in time by analyzing the output.

Like output, all promises are also intercepted.  This allows the code to ensure that all promises have been resolved before completing the test.  Any uncompleted promises will automatically trigger an error state and fail the test.
`;
