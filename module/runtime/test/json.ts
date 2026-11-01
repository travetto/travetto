import assert from 'node:assert';

import { CodecUtil, JSONUtil } from '@travetto/runtime';
import { Suite, Test, TestFixtures } from '@travetto/test';

@Suite()
export class JSONUtilSuite {
  fixture = new TestFixtures();
  @Test()
  async parseSafeString() {
    const obj: { name: string } = JSONUtil.fromUTF8('{"name":"test"}');
    assert.deepStrictEqual(obj, { name: 'test' });
  }

  @Test()
  async parseSafeBuffer() {
    const buffer = CodecUtil.fromUTF8String('{"count":42}');
    const obj: { count: number } = JSONUtil.fromBinaryArray(buffer);
    assert.deepStrictEqual(obj, { count: 42 });
  }

  @Test()
  async parseSafeWithReviver() {
    const json = '{"date":"2025-12-21"}';
    const obj: { date: Date } = JSONUtil.fromUTF8(json, {
      reviver: (key, value) => {
        if (key === 'date' && typeof value === 'string') {
          return new Date(value);
        }
        return value;
      }
    });
    assert(obj.date instanceof Date);
    assert.strictEqual(obj.date.toISOString().split('T')[0], '2025-12-21');

    const obj2: { date: Date } = JSONUtil.fromUTF8(
      JSONUtil.toUTF8({
        date: new Date('2025-12-21')
      }),
      { reviver: JSONUtil.TRANSMIT_REVIVER }
    );
    assert(obj2.date instanceof Date);
    assert.strictEqual(obj2.date.toISOString().split('T')[0], '2025-12-21');
  }

  @Test()
  async encodeBase64JSONSimple() {
    const encoded = JSONUtil.toBase64({ foo: 'bar' });
    assert.strictEqual(encoded, CodecUtil.utf8ToBase64('{"foo":"bar"}'));
  }

  @Test()
  async encodeBase64JSONComplex() {
    const data = { items: [1, 2, 3], nested: { key: 'value' } };
    const encoded = JSONUtil.toBase64(data);
    assert.strictEqual(typeof encoded, 'string');
    // Verify it can be decoded back
    const decoded: typeof data = JSONUtil.fromBase64(encoded!);
    assert.deepStrictEqual(decoded, data);
  }

  @Test()
  async decodeBase64JSONSimple() {
    const original = { test: 'data' };
    const encoded = CodecUtil.utf8ToBase64(JSON.stringify(original));
    const decoded: typeof original = JSONUtil.fromBase64(encoded);
    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async decodeBase64JSONWithURIEncoding() {
    const original = { special: 'chars' };
    const encoded = CodecUtil.utf8ToBase64(encodeURIComponent(JSON.stringify(original)));
    const decoded: typeof original = JSONUtil.fromBase64(encoded);
    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async decodeBase64JSONEmpty() {
    const decoded = JSONUtil.fromBase64('');
    assert.strictEqual(decoded, undefined);
  }

  @Test()
  async parseSafeInvalidJSON() {
    assert.throws(() => {
      JSONUtil.fromUTF8('not valid json');
    });
  }

  @Test()
  async roundTripBase64JSON() {
    const original = {
      string: 'hello',
      number: 123,
      boolean: true,
      null: null,
      array: [1, 'two', { three: 3 }],
      object: { nested: { deep: 'value' } }
    };

    const encoded = JSONUtil.toBase64(original);
    const decoded: typeof original = JSONUtil.fromBase64(encoded!);

    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async verifyFromCSV() {
    const records: { name: string; age: string; city: string }[] = [];
    for await (const row of JSONUtil.fromCSV<(typeof records)[0]>(this.fixture.readLines('sample.csv'))) {
      records.push(row);
    }

    assert.strictEqual(records.length, 3);
    assert.deepStrictEqual(records[0], { name: 'Alice', age: '30', city: 'Seattle' });
    assert.deepStrictEqual(records[1], { name: 'Bob', age: '25', city: 'New York, NY' });
    assert.deepStrictEqual(records[2], { name: 'Charlie "Chuck"', age: '40', city: 'Chicago' });
  }

  @Test()
  async verifyFromTSV() {
    const records: { id: string; title: string; score: string }[] = [];
    for await (const row of JSONUtil.fromCSV<(typeof records)[0]>(this.fixture.readLines('sample.tsv'))) {
      records.push(row);
    }

    assert.strictEqual(records.length, 3);
    assert.deepStrictEqual(records[0], { id: '1', title: 'Alpha', score: '95' });
    assert.deepStrictEqual(records[1], { id: '2', title: 'Beta', score: '88' });
    assert.deepStrictEqual(records[2], { id: '3', title: 'Gamma', score: '100' });
  }

  @Test()
  async verifyFromCSVSynchronousWithBlankLines() {
    const lines = ['', 'name,age,city', '   ', 'Alice,30,Seattle', '', 'Bob,25,"New York, NY"', '   \t  ', 'Charlie,40,Chicago', ''];

    const records: { name: string; age: string; city: string }[] = [];
    for await (const row of JSONUtil.fromCSV<{ name: string; age: string; city: string }>(lines)) {
      records.push(row);
    }

    assert.strictEqual(records.length, 3);
    assert.deepStrictEqual(records[0], { name: 'Alice', age: '30', city: 'Seattle' });
    assert.deepStrictEqual(records[1], { name: 'Bob', age: '25', city: 'New York, NY' });
    assert.deepStrictEqual(records[2], { name: 'Charlie', age: '40', city: 'Chicago' });

    const defaultRecords: Record<string, string>[] = [];
    for await (const row of JSONUtil.fromCSV(lines)) {
      defaultRecords.push(row);
    }
    assert.strictEqual(defaultRecords.length, 3);
    assert.deepStrictEqual(defaultRecords[0], { name: 'Alice', age: '30', city: 'Seattle' });
  }

  @Test()
  async verifyFromUTF8LinesWithAsyncIterable() {
    type SampleRecord = { id: number; name: string; active?: boolean; tags?: string[] };
    const records: SampleRecord[] = [];
    for await (const record of JSONUtil.fromUTF8Lines<SampleRecord>(this.fixture.readLines('sample.ndjson'))) {
      records.push(record);
    }

    assert.strictEqual(records.length, 3);
    assert.deepStrictEqual(records[0], { id: 1, name: 'first', active: true });
    assert.deepStrictEqual(records[1], { id: 2, name: 'second', active: false });
    assert.deepStrictEqual(records[2], { id: 3, name: 'third', tags: ['a', 'b'] });
  }

  @Test()
  async verifyFromUTF8LinesWithSynchronousIterableAndBlankLines() {
    const lines = [
      '',
      '  {"identifier": 100, "message": "hello"}  ',
      '   ',
      '{"identifier": 200, "message": "world"}',
      '\t\r\n',
      '{"identifier": 300, "message": "test"}'
    ];

    type MessageRecord = { identifier: number; message: string };
    const records: MessageRecord[] = [];
    for await (const record of JSONUtil.fromUTF8Lines<MessageRecord>(lines)) {
      records.push(record);
    }

    assert.strictEqual(records.length, 3);
    assert.deepStrictEqual(records[0], { identifier: 100, message: 'hello' });
    assert.deepStrictEqual(records[1], { identifier: 200, message: 'world' });
    assert.deepStrictEqual(records[2], { identifier: 300, message: 'test' });

    const defaultRecords: object[] = [];
    for await (const record of JSONUtil.fromUTF8Lines(lines)) {
      defaultRecords.push(record);
    }
    assert.strictEqual(defaultRecords.length, 3);
    assert.deepStrictEqual(defaultRecords[0], { identifier: 100, message: 'hello' });
  }

  @Test()
  async verifyFromUTF8LinesEmpty() {
    const emptyLines: string[] = ['', '   ', '\t', '\n'];
    const records: object[] = [];
    for await (const record of JSONUtil.fromUTF8Lines(emptyLines)) {
      records.push(record);
    }
    assert.strictEqual(records.length, 0);

    const completelyEmpty: string[] = [];
    for await (const record of JSONUtil.fromUTF8Lines(completelyEmpty)) {
      records.push(record);
    }
    assert.strictEqual(records.length, 0);
  }

  @Test()
  async verifyFromUTF8LinesWithInvalidJSON() {
    const lines = ['{"valid": true}', '{"invalid":'];
    const records: object[] = [];
    await assert.rejects(async () => {
      for await (const record of JSONUtil.fromUTF8Lines(lines)) {
        records.push(record);
      }
    }, SyntaxError);
    assert.strictEqual(records.length, 1);
    assert.deepStrictEqual(records[0], { valid: true });
  }
}
