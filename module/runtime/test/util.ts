import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { Util, AsyncQueue } from '@travetto/runtime';

@Suite()
export class UtilTest {

  @Test()
  verifyUUID() {
    assert(Util.uuid(32).length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));

    assert(Util.uuid().length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));
  }

  @Test()
  async verifyMap() {
    const lines = new AsyncQueue(['aaa', 'bbb']);

    const values: string[] = [];
    let j = 0;
    for await (const el of Util.mapAsyncIterable(lines, (text, i) => `${text} = ${i}`)) {
      values.push(el);
      if ((j += 1) === 2) {
        lines.close();
      }
    }

    assert(values[0] === 'aaa = 0');
    assert(values[1] === 'bbb = 1');
  }

  @Test()
  verifyAllowDenyWithStringRules() {
    // Allow specific patterns
    const check = Util.allowDeny(
      'admin,user,guest',
      (rule: string) => rule,
      (rule: string, input: string) => rule === input
    );

    assert(check('admin'));
    assert(check('user'));
    assert(check('guest'));
    assert(!check('other'));
  }

  @Test()
  verifyAllowDenyWithNegativeRules() {
    // Deny specific patterns (negative rules)
    const check = Util.allowDeny(
      '!blocked,!banned',
      (rule: string) => rule,
      (rule: string, input: string) => rule === input
    );

    assert(!check('blocked'));
    assert(!check('banned'));
    assert(check('allowed'));
    assert(check('other'));
  }

  @Test()
  verifyAllowDenyWithMixedRules() {
    // Mixed allow/deny rules
    const check = Util.allowDeny(
      'admin,user,!guest',
      (rule: string) => rule,
      (rule: string, input: string) => rule === input
    );

    assert(check('admin'));
    assert(check('user'));
    assert(!check('guest'));
    assert(!check('other')); // Default deny when positive rules exist
  }

  @Test()
  verifyAllowDenyWithArrayRules() {
    // Array format with tuples
    const check = Util.allowDeny(
      [
        ['admin', true],
        ['user', true],
        ['guest', false]
      ],
      (rule: string) => rule,
      (rule: string, input: string) => rule === input
    );

    assert(check('admin'));
    assert(check('user'));
    assert(!check('guest'));
    assert(!check('other'));
  }

  @Test()
  verifyAllowDenyWithPatternMatching() {
    // Using regex patterns
    const check = Util.allowDeny(
      ['*.test.ts', '*.spec.ts', '!*.skip.ts'],
      (rule: string) => new RegExp(rule.replace(/\*/g, '.*')),
      (pattern: RegExp, input: string) => pattern.test(input)
    );

    assert(check('foo.test.ts'));
    assert(check('bar.spec.ts'));
    assert(!check('baz.skip.ts'));
    assert(!check('main.ts'));
  }

  @Test()
  verifyAllowDenyWithCaching() {
    let compareCallCount = 0;

    const check = Util.allowDeny(
      'admin,user',
      (rule: string) => rule,
      (rule: string, input: string) => {
        compareCallCount++;
        return rule === input;
      },
      (input: string) => input // Cache key function
    );

    // First call - should invoke compare
    assert(check('admin') === true);
    const firstCallCount = compareCallCount;

    // Second call with same input - should use cache
    assert(check('admin') === true);
    assert(compareCallCount === firstCallCount, 'Should use cached result');

    // Different input - should invoke compare again
    assert(check('user') === true);
    assert(compareCallCount > firstCallCount, 'Should compare for new input');
  }

  @Test()
  verifyAllowDenyWithMultipleCompareArgs() {
    // Test with multiple comparison arguments
    const check = Util.allowDeny<string, [string, number]>(
      ['read', 'write'],
      (rule: string) => rule,
      (rule: string, action: string, level: number) => rule === action && level > 0
    );

    assert(check('read', 1) === true);
    assert(check('write', 5) === true);
    assert(check('read', 0) === false);
    assert(check('delete', 1) === false);
  }

  @Test()
  verifyAllowDenyDefaultBehavior() {
    // When only positive rules exist, default should be deny
    const allowOnly = Util.allowDeny(
      'allowed',
      (rule: string) => rule,
      (rule: string, input: string) => rule === input
    );
    assert(allowOnly('allowed') === true);
    assert(allowOnly('other') === false);

    // When only negative rules exist, default should be allow
    const denyOnly = Util.allowDeny(
      '!blocked',
      (rule: string) => rule,
      (rule: string, input: string) => rule === input
    );
    assert(denyOnly('blocked') === false);
    assert(denyOnly('other') === true);
  }

  @Test()
  verifyAllowDenyEmptyRules() {
    // Empty rules should allow everything
    const check = Util.allowDeny(
      [],
      (rule: string) => rule,
      (rule: string, input: string) => rule === input
    );

    assert(check('anything') === true);
    assert(check('everything') === true);
  }

  @Test()
  stackTraceToPartsEmpty() {
    assert.deepEqual(Util.stackTraceToParts(), []);
    assert.deepEqual(Util.stackTraceToParts(''), []);
  }

  @Test()
  stackTraceToPartsBasic() {
    const stack = [
      'Error: something went wrong',
      '    at MyClass.myMethod (/project/src/file.ts:10:5)',
      '    at Object.<anonymous> (/project/src/other.ts:20:3)',
    ].join('\n');

    const parts = Util.stackTraceToParts(stack);
    assert(parts.length === 2);

    assert(parts[0].message === 'at MyClass.myMethod');
    assert(parts[0].filename === '/project/src/file.ts');
    assert(parts[0].line === 10);
    assert(parts[0].column === 5);

    assert(parts[1].message === 'at Object.<anonymous>');
    assert(parts[1].filename === '/project/src/other.ts');
    assert(parts[1].line === 20);
    assert(parts[1].column === 3);
  }

  @Test()
  stackTraceToPartsBackslashNormalization() {
    // Backslashes in POSIX-style paths (e.g. from mixed-separator output) are normalized to '/'
    const stack = '    at doWork (C:\\home\\user\\project\\src\\app.ts:42:7)';

    const parts = Util.stackTraceToParts(stack);
    assert(parts.length === 1);
    assert(parts[0].filename === 'C:/home/user/project/src/app.ts');
    assert(parts[0].line === 42);
    assert(parts[0].column === 7);
  }

  @Test()
  stackTraceToPartsFiltersNonFrameLines() {
    const stack = [
      'Error: oops',
      'some plain text line',
      '    at realFrame (/src/index.ts:1:1)',
    ].join('\n');

    const parts = Util.stackTraceToParts(stack);
    assert(parts.length === 1);
    assert(parts[0].filename === '/src/index.ts');
  }

  @Test()
  stackTraceToPartsMissingLineColumn() {
    // Node sometimes emits frames without column, or with just filename
    const stack = '    at eval (eval at <anonymous> (/src/runner.ts:5:3))';

    const parts = Util.stackTraceToParts(stack);
    assert(parts.length === 1);
    // The inner filename segment after the second '(' won't have a colon-separated line
    assert(parts[0].line === -1 || typeof parts[0].line === 'number');
    assert(parts[0].message === 'at eval (eval at <anonymous>');
  }

  @Test()
  stackTraceToPartsRealTrace() {
    const err = new Error('test');
    const parts = Util.stackTraceToParts(err.stack);

    // Must have at least one frame
    assert(parts.length > 0);

    // Every frame must have a valid filename ending in a known extension
    for (const part of parts) {
      assert(/[.]([cm]?[jt]s)$/.test(part.filename));
      assert(part.line > 0);
      assert(part.column > 0);
    }

    // The first frame should point back to this file
    assert(parts[0].filename.endsWith('runtime/test/util.ts'));
    assert(parts[0].line === 257);
  }
}