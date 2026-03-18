import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { Env } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';
import { Registry } from '@travetto/registry';

import { CliCommand, CliModuleFlag, CliParseUtil } from '@travetto/cli';

/**
 * My command
 */
@CliCommand()
class WithModule {

  @CliModuleFlag({ short: 'm' })
  module: string;

  main() { }
}

const expand = async (args: string[]): Promise<string[]> => CliParseUtil.expandArgs(
  SchemaRegistryIndex.getConfig(WithModule),
  CliParseUtil.getArgs(args).args
);

@Suite()
class ParseSuite {

  @BeforeAll()
  async setup() {
    await Registry.init();
  }

  @Test()
  async testArgs() {
    const expected = { cmd: 'bob', args: ['--help'], help: true };
    const expectedWithoutCmd = { cmd: undefined, args: ['--help', 'bob'], help: true };
    assert.deepStrictEqual(CliParseUtil.getArgs(['--help', 'bob']), expectedWithoutCmd);
    assert.deepStrictEqual(CliParseUtil.getArgs(['bob', '--help']), expected);
    assert.deepStrictEqual(CliParseUtil.getArgs([...process.argv.slice(0, 2), 'bob', '--help']), expected);
    assert.deepStrictEqual(CliParseUtil.getArgs([...process.argv.slice(0, 2), '--help', 'bob']), expectedWithoutCmd);
    assert.match((CliParseUtil.getArgs(process.argv)).cmd!, /test(:.*)?$/);
  }

  @Test()
  async testNegative() {
    assert.deepStrictEqual(CliParseUtil.getArgs(['-a=-5', '-b', '-5']), { cmd: undefined, args: ['-a=-5', '-b', '-5'], help: false });
  }

  @Test()
  async testHOverlap() {
    assert.deepStrictEqual(CliParseUtil.getArgs(['-hp', '-5']), { cmd: undefined, args: ['-hp', '-5'], help: false });
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