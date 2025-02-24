import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Env } from '@travetto/runtime';

import { CliCommand, CliCommandSchemaUtil, CliParseUtil } from '../__index__.ts';

/**
 * My command
 */
@CliCommand({ with: { module: true } })
class WithModule {
  main() { }
}

const expand = async (args: string[]): Promise<string[]> => CliParseUtil.expandArgs(
  await CliCommandSchemaUtil.getSchema(WithModule),
  CliParseUtil.getArgs(args).args
);

@Suite()
export class ParseSuite {
  @Test()
  async testArgs() {
    const expected = { cmd: 'bob', args: ['-h'], help: true };
    const expectedWithoutCmd = { cmd: undefined, args: ['-h', 'bob'], help: true };
    assert.deepStrictEqual(CliParseUtil.getArgs(['-h', 'bob']), expectedWithoutCmd);
    assert.deepStrictEqual(CliParseUtil.getArgs(['bob', '-h']), expected);
    assert.deepStrictEqual(CliParseUtil.getArgs([...process.argv.slice(0, 2), 'bob', '-h']), expected);
    assert.deepStrictEqual(CliParseUtil.getArgs([...process.argv.slice(0, 2), '-h', 'bob']), expectedWithoutCmd);
    assert.match((CliParseUtil.getArgs(process.argv)).cmd!, /test(:.*)?$/);
  }

  @Test()
  async testTokens() {
    assert.deepStrictEqual(CliParseUtil.readToken('hello world'), { value: 'hello', next: 6 });
    assert.deepStrictEqual(CliParseUtil.readToken('hello world', 4), { value: 'o', next: 6 });
    assert.deepStrictEqual(CliParseUtil.readToken("'hello world'", 0), { value: 'hello world', next: 13 });

  }

  @Test()
  async testExpand() {
    assert.deepStrictEqual(
      await expand(['bob', 'hello world', '+=@travetto/cli#test/fixtures/random.flags']),
      ['hello world', '--hello', "goodbye's moon", '-b', '20']
    );

    assert.deepStrictEqual(
      await expand(['bob', 'hello world', '--module', '@travetto/cli', '+=@#test/fixtures/random.flags']),
      ['hello world', '--module', '@travetto/cli', '--hello', "goodbye's moon", '-b', '20']
    );

    assert.deepStrictEqual(
      await expand(['bob', 'hello world', '--module=@travetto/cli', '+=@#test/fixtures/random.flags']),
      ['hello world', '--module=@travetto/cli', '--hello', "goodbye's moon", '-b', '20']
    );

    assert.deepStrictEqual(
      await expand(['bob', 'hello world', '-m', '@travetto/cli', '+=@#test/fixtures/random.flags']),
      ['hello world', '-m', '@travetto/cli', '--hello', "goodbye's moon", '-b', '20']
    );

    Env.TRV_MODULE.set('@travetto/cli');
    assert.deepStrictEqual(
      await expand(['bob', 'hello world', '+=@#test/fixtures/random.flags']),
      ['hello world', '--hello', "goodbye's moon", '-b', '20']
    );
  }
}