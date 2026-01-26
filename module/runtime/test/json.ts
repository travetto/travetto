import assert from 'node:assert';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { JSONUtil } from '../src/json.ts';
import { EncodeUtil } from '../src/encode.ts';

@Suite()
export class JSONUtilTest {

  @Test()
  async parseSafeString() {
    const obj: { name: string } = JSONUtil.parseSafe('{"name":"test"}');
    assert.deepStrictEqual(obj, { name: 'test' });
  }

  @Test()
  async parseSafeBuffer() {
    const buffer = EncodeUtil.fromUTF8String('{"count":42}');
    const obj: { count: number } = JSONUtil.parseSafe(buffer);
    assert.deepStrictEqual(obj, { count: 42 });
  }

  @Test()
  async parseSafeWithReviver() {
    const json = '{"date":"2025-12-21"}';
    const obj: { date: Date } = JSONUtil.parseSafe(json, (key, value) => {
      if (key === 'date') {
        return new Date(value);
      }
      return value;
    });
    assert(obj.date instanceof Date);
    assert.strictEqual(obj.date.toISOString().split('T')[0], '2025-12-21');
  }

  @Test()
  async encodeBase64Simple() {
    const encoded = JSONUtil.stringifyBase64({ foo: 'bar' });
    assert.strictEqual(encoded, EncodeUtil.fromUTF8String('{"foo":"bar"}').toString('base64'));
  }

  @Test()
  async encodeBase64Complex() {
    const data = { items: [1, 2, 3], nested: { key: 'value' } };
    const encoded = JSONUtil.stringifyBase64(data);
    assert.strictEqual(typeof encoded, 'string');
    // Verify it can be decoded back
    const decoded: typeof data = JSONUtil.parseBase64(encoded!);
    assert.deepStrictEqual(decoded, data);
  }

  @Test()
  async encodeBase64Undefined() {
    const encoded = JSONUtil.stringifyBase64(undefined);
    assert.strictEqual(encoded, undefined);
  }

  @Test()
  async decodeBase64Simple() {
    const original = { test: 'data' };
    const encoded = EncodeUtil.fromUTF8String(JSON.stringify(original)).toString('base64');
    const decoded: typeof original = JSONUtil.parseBase64(encoded);
    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async decodeBase64WithURIEncoding() {
    const original = { special: 'chars' };
    const encoded = EncodeUtil.fromUTF8String(encodeURIComponent(JSON.stringify(original))).toString('base64');
    const decoded: typeof original = JSONUtil.parseBase64(encoded);
    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async decodeBase64Empty() {
    const decoded = JSONUtil.parseBase64('');
    assert.strictEqual(decoded, undefined);
  }

  @Test()
  async decodeBase64Undefined() {
    const decoded = JSONUtil.parseBase64(undefined);
    assert.strictEqual(decoded, undefined);
  }

  @Test()
  async readFileAsync() {
    const fixtures = new TestFixtures();

    const result = await JSONUtil.readFile(await fixtures.resolve('basic.json'));
    assert.deepStrictEqual(result, { async: true, values: [1, 2, 3] });
  }

  @Test()
  async readFileSyncExists() {
    const fixtures = new TestFixtures();

    const result = JSONUtil.readFileSync(await fixtures.resolve('basic.json'));
    assert.deepStrictEqual(result, { async: true, values: [1, 2, 3] });
  }

  @Test()
  async readFileSyncMissingWithDefault() {
    const defaultValue = { default: true };
    const result = JSONUtil.readFileSync('-', defaultValue);
    assert.deepStrictEqual(result, defaultValue);
  }

  @Test()
  async readFileSyncMissingNoDefault() {
    assert.throws(() => {
      JSONUtil.readFileSync('-');
    });
  }

  @Test()
  async parseSafeInvalidJSON() {
    assert.throws(() => {
      JSONUtil.parseSafe('not valid json');
    });
  }

  @Test()
  async roundTripBase64() {
    const original = {
      string: 'hello',
      number: 123,
      boolean: true,
      null: null,
      array: [1, 'two', { three: 3 }],
      object: { nested: { deep: 'value' } }
    };

    const encoded = JSONUtil.stringifyBase64(original);
    const decoded: typeof original = JSONUtil.parseBase64(encoded!);

    assert.deepStrictEqual(decoded, original);
  }
}