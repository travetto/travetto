import crypto from 'node:crypto';
import assert from 'node:assert';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { CodecUtil } from '@travetto/runtime';

@Suite()
export class EncodeUtilTest {

  fixture = new TestFixtures();

  @Test()
  async verifySimpleHash() {
    const hash = crypto.createHash('sha512');
    hash.update('roger');
    const key = hash.digest('hex');

    assert(CodecUtil.hash('roger', { length: 64 }) === key.substring(0, 64));

    const hash2 = crypto.createHash('sha512');
    hash2.update('');
    const unKey = hash2.digest('hex');

    assert(CodecUtil.hash('', { length: 20 }) === unKey.substring(0, 20));

    assert(CodecUtil.hash('', { length: 20 }) !== key.substring(0, 20));
  }


  @Test()
  async parseSafeString() {
    const obj: { name: string } = CodecUtil.fromJSON('{"name":"test"}');
    assert.deepStrictEqual(obj, { name: 'test' });
  }

  @Test()
  async parseSafeBuffer() {
    const buffer = CodecUtil.fromUTF8String('{"count":42}');
    const obj: { count: number } = CodecUtil.fromJSON(buffer);
    assert.deepStrictEqual(obj, { count: 42 });
  }

  @Test()
  async parseSafeWithReviver() {
    const json = '{"date":"2025-12-21"}';
    const obj: { date: Date } = CodecUtil.fromJSON(json, (key, value) => {
      if (key === 'date') {
        return new Date(value);
      }
      return value;
    });
    assert(obj.date instanceof Date);
    assert.strictEqual(obj.date.toISOString().split('T')[0], '2025-12-21');
  }

  @Test()
  async encodeBase64JSONSimple() {
    const encoded = CodecUtil.toBase64JSON({ foo: 'bar' });
    assert.strictEqual(encoded, CodecUtil.fromUTF8String('{"foo":"bar"}').toString('base64'));
  }

  @Test()
  async encodeBase64JSONComplex() {
    const data = { items: [1, 2, 3], nested: { key: 'value' } };
    const encoded = CodecUtil.toBase64JSON(data);
    assert.strictEqual(typeof encoded, 'string');
    // Verify it can be decoded back
    const decoded: typeof data = CodecUtil.fromBase64JSON(encoded!);
    assert.deepStrictEqual(decoded, data);
  }

  @Test()
  async encodeBase64JSONUndefined() {
    const encoded = CodecUtil.toBase64JSON(undefined);
    assert.strictEqual(encoded, undefined);
  }

  @Test()
  async decodeBase64JSONSimple() {
    const original = { test: 'data' };
    const encoded = CodecUtil.fromUTF8String(JSON.stringify(original)).toString('base64');
    const decoded: typeof original = CodecUtil.fromBase64JSON(encoded);
    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async decodeBase64JSONWithURIEncoding() {
    const original = { special: 'chars' };
    const encoded = CodecUtil.fromUTF8String(encodeURIComponent(JSON.stringify(original))).toString('base64');
    const decoded: typeof original = CodecUtil.fromBase64JSON(encoded);
    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async decodeBase64JSONEmpty() {
    const decoded = CodecUtil.fromBase64JSON('');
    assert.strictEqual(decoded, undefined);
  }

  @Test()
  async decodeBase64JSONUndefined() {
    const decoded = CodecUtil.fromBase64JSON(undefined);
    assert.strictEqual(decoded, undefined);
  }

  @Test()
  async parseSafeInvalidJSON() {
    assert.throws(() => {
      CodecUtil.fromJSON('not valid json');
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

    const encoded = CodecUtil.toBase64JSON(original);
    const decoded: typeof original = CodecUtil.fromBase64JSON(encoded!);

    assert.deepStrictEqual(decoded, original);
  }
}