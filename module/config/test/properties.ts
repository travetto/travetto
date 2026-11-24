import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { PropertiesConfigParser } from '../src/parser/properties.ts';

@Suite()
export class PropertiesConfigParserTest {
  @Test()
  verifyParseLine() {
    assert.deepStrictEqual(PropertiesConfigParser.parseLine('host = localhost'), ['host', 'localhost']);
    assert.deepStrictEqual(PropertiesConfigParser.parseLine('port: 8080'), ['port', '8080']);
    assert.deepStrictEqual(PropertiesConfigParser.parseLine('db\\:url = postgres://localhost'), ['db:url', 'postgres://localhost']);
    assert.deepStrictEqual(PropertiesConfigParser.parseLine('key\\=name: value'), ['key=name', 'value']);

    assert.strictEqual(PropertiesConfigParser.parseLine('# comment = ignored'), undefined);
    assert.strictEqual(PropertiesConfigParser.parseLine('! comment = ignored'), undefined);
    assert.strictEqual(PropertiesConfigParser.parseLine('no_separator'), undefined);
    assert.strictEqual(PropertiesConfigParser.parseLine('empty='), undefined);
  }

  @Test()
  verifyParseLines() {
    const parsed = PropertiesConfigParser.parseLines(
      ['# Header comment', 'host = localhost', 'port: 8080', 'description = hello \\', 'world', '! Trailing comment'].join('\n')
    );

    assert.deepStrictEqual(parsed, {
      host: 'localhost',
      port: '8080',
      description: 'hello world'
    });
  }
}
