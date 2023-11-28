import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { CliParseUtil } from '../__index__';

@Suite()
export class ParseSuite {
  @Test()
  async testArgs() {
    const expected = { cmd: 'bob', args: ['-h'], help: true };
    const expectedWithoutCmd = { cmd: undefined, args: ['-h', 'bob'], help: true };
    assert.deepStrictEqual(await CliParseUtil.getArgs(['-h', 'bob']), expectedWithoutCmd);
    assert.deepStrictEqual(await CliParseUtil.getArgs(['bob', '-h']), expected);
    assert.deepStrictEqual(await CliParseUtil.getArgs([...process.argv.slice(0, 2), 'bob', '-h']), expected);
    assert.deepStrictEqual(await CliParseUtil.getArgs([...process.argv.slice(0, 2), '-h', 'bob']), expectedWithoutCmd);
    assert.match((await CliParseUtil.getArgs(process.argv)).cmd!, /test(:.*)?$/);
  }

  @Test()
  async testTokens() {
    assert.deepStrictEqual(CliParseUtil.readToken('hello world'), { value: 'hello', next: 6 });
    assert.deepStrictEqual(CliParseUtil.readToken('hello world', 1), { value: 'ello', next: 6 });
    assert.deepStrictEqual(CliParseUtil.readToken("'hello world'", 0), { value: 'hello world', next: 13 });
    assert.deepStrictEqual(
      await CliParseUtil.getArgs(
        ['bob', 'hello world', '+=@/test/fixtures/random.flags']
      ),
      { cmd: 'bob', args: ['hello world', '--hello', "goodbye's moon", '-b', '20'], help: false }
    );
  }
}