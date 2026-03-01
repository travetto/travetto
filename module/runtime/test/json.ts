import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CodecUtil, JSONUtil } from '@travetto/runtime';

@Suite()
class JSONUtilSuite {

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


    const obj2: { date: Date } = JSONUtil.fromUTF8(JSONUtil.toUTF8({
      date: new Date('2025-12-21')
    }), { reviver: JSONUtil.TRANSMIT_REVIVER });
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
}