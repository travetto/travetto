/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { RuntimeIndex } from '@travetto/runtime';

import { Suite } from './src/decorator/suite';
import { Test } from './src/decorator/test';

export const text = <>
  <c.StdHeader />
  This module provides unit testing functionality that integrates with the framework. It is a declarative framework, using decorators to define tests and suites. The test produces results in the following formats:

  <ul>
    <li>{d.library('TAP')}, default and human-readable</li>
    <li>{d.library('JSON')}, best for integrating with at a code level</li>
    <li>{d.library('XUnit')}, standard format for CI/CD systems e.g. Jenkins, Bamboo, etc.</li>
  </ul>

  <c.Note>All tests should be under the {d.path('test/.*')} folders.  The pattern for tests is defined as a regex and not standard globbing.</c.Note>

  <c.Section title='Definition'>

    A test suite is a collection of individual tests.  All test suites are classes with the {Suite} decorator. Tests are defined as methods on the suite class, using the {Test} decorator.  All tests intrinsically support {d.input('async')}/{d.input('await')}. <br />

    A simple example would be:

    <c.Code title='Example Test Suite' src='doc/example.ts' />
  </c.Section>

  <c.Section title='Assertions'>
    A common aspect of the tests themselves are the assertions that are made.  {d.library('Node')} provides a built-in {d.library('Assert')} library.  The framework uses AST transformations to modify the assertions to provide integration with the test module, and to provide a much higher level of detail in the failed assertions.  For example:

    <c.Code title='Example assertion for deep comparison' src='doc/assert-example.ts' />

    would translate to:

    <c.Code title='Transpiled test Code' src={RuntimeIndex.resolveFileImport('@travetto/test/doc/assert-example.ts')} language='javascript' />

    This would ultimately produce the error like:

    <c.Code title='Sample Validation Error' src={`
AssertionError(
  message="{size: 20, address: {state: 'VA' }} should deeply strictly equal {}"
)
`} />

    The equivalences for all of the {d.library('Assert')} operations are:

    <ul>
      <li>{d.method('assert(a == b)')} as {d.method('assert.equal(a, b)')}</li>
      <li>{d.method('assert(a !== b)')} as {d.method('assert.notEqual(a, b)')}</li>
      <li>{d.method('assert(a === b)')} as {d.method('assert.strictEqual(a, b)')}</li>
      <li>{d.method('assert(a !== b)')} as {d.method('assert.notStrictEqual(a, b)')}</li>
      <li>{d.method('assert(a >= b)')} as {d.method('assert.greaterThanEqual(a, b)')}</li>
      <li>{d.method('assert(a > b)')} as {d.method('assert.greaterThan(a, b)')}</li>
      <li>{d.method('assert(a <= b)')} as {d.method('assert.lessThanEqual(a, b)')}</li>
      <li>{d.method('assert(a < b)')} as {d.method('assert.lessThan(a, b)')}</li>
      <li>{d.method('assert(a instanceof b)')} as {d.method('assert.instanceOf(a, b)')}</li>
      <li>{d.method('assert(a.includes(b))')} as {d.method('assert.ok(a.includes(b))')}</li>
      <li>{d.method('assert(/a/.test(b))')} as {d.method('assert.ok(/a/.test(b))')}</li>
    </ul>


    In addition to the standard operations, there is support for throwing/rejecting errors (or the inverse).  This is useful for testing error states or ensuring errors do not occur.
    <c.SubSection title='Throws'>
      {d.method('throws')}/{d.method('doesNotThrow')} is for catching synchronous rejections
      <c.Code title='Throws vs Does Not Throw' src='doc/throws.ts' />
    </c.SubSection>

    <c.SubSection title='Rejects'>
      {d.method('rejects')}/{d.method('doesNotReject')} is for catching asynchronous rejections
      <c.Code title='Rejects vs Does Not Reject' src='doc/rejects.ts' />
    </c.SubSection>

    <c.SubSection title='Error Matching'>
      Additionally, the {d.method('throws')}/{d.method('rejects')} assertions take in a secondary parameter to allow for specification of the type of error expected. This can be:
      <ul>
        <li>A regular expression or string to match against the error's message</li>
        <li>A class to ensure the returned error is an instance of the class passed in</li>
        <li>A function to allow for whatever custom verification of the error is needed</li>
      </ul>

      <c.Code title='Example of different Error matching paradigms' src='doc/error-types.ts' />
    </c.SubSection>
  </c.Section>

  <c.Section title='Running Tests'>

    To run the tests you can either call the {d.mod('Cli')} by invoking

    <c.Execution title='Test Help Output' cmd='trv' args={['test', '--help']} />

    The regexes are the patterns of tests you want to run, and all tests must be found under the {d.path('test/')} folder.

    <c.SubSection title='Travetto Plugin'>
      The {d.library('TravettoPlugin')} also supports test running,  which will provide even more functionality for real-time testing and debugging.
    </c.SubSection>
  </c.Section>

  <c.Section title='Additional Considerations'>
    During the test execution, a few things additionally happen that should be helpful.  The primary addition, is that all console output is captured, and will be exposed in the test output.  This allows for investigation at a later point in time by analyzing the output. <br />

    Like output, all promises are also intercepted.  This allows the code to ensure that all promises have been resolved before completing the test.  Any uncompleted promises will automatically trigger an error state and fail the test.
  </c.Section>
</>;
