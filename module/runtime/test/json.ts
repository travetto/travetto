import assert from 'node:assert';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { JSONUtil } from '../src/json';

@Suite()
export class JSONUtilTest {

  @Test()
  async parseSafeString() {
    const obj = JSONUtil.parseSafe<{ name: string }>('{"name":"test"}');
    assert.deepStrictEqual(obj, { name: 'test' });
  }

  @Test()
  async parseSafeBuffer() {
    const buffer = Buffer.from('{"count":42}', 'utf8');
    const obj = JSONUtil.parseSafe<{ count: number }>(buffer);
    assert.deepStrictEqual(obj, { count: 42 });
  }

  @Test()
  async parseSafeWithReviver() {
    const json = '{"date":"2025-12-21"}';
    const obj = JSONUtil.parseSafe<{ date: Date }>(json, (key, value) => {
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
    const encoded = JSONUtil.encodeBase64({ foo: 'bar' });
    assert.strictEqual(encoded, Buffer.from('{"foo":"bar"}').toString('base64'));
  }

  @Test()
  async encodeBase64Complex() {
    const data = { items: [1, 2, 3], nested: { key: 'value' } };
    const encoded = JSONUtil.encodeBase64(data);
    assert.strictEqual(typeof encoded, 'string');
    // Verify it can be decoded back
    const decoded = JSONUtil.decodeBase64<typeof data>(encoded!);
    assert.deepStrictEqual(decoded, data);
  }

  @Test()
  async encodeBase64Undefined() {
    const encoded = JSONUtil.encodeBase64(undefined);
    assert.strictEqual(encoded, undefined);
  }

  @Test()
  async decodeBase64Simple() {
    const original = { test: 'data' };
    const encoded = Buffer.from(JSON.stringify(original)).toString('base64');
    const decoded = JSONUtil.decodeBase64<typeof original>(encoded);
    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async decodeBase64WithURIEncoding() {
    const original = { special: 'chars' };
    const encoded = Buffer.from(encodeURIComponent(JSON.stringify(original))).toString('base64');
    const decoded = JSONUtil.decodeBase64<typeof original>(encoded);
    assert.deepStrictEqual(decoded, original);
  }

  @Test()
  async decodeBase64Empty() {
    const decoded = JSONUtil.decodeBase64('');
    assert.strictEqual(decoded, undefined);
  }

  @Test()
  async decodeBase64Undefined() {
    const decoded = JSONUtil.decodeBase64(undefined);
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

    const encoded = JSONUtil.encodeBase64(original);
    const decoded = JSONUtil.decodeBase64<typeof original>(encoded!);

    assert.deepStrictEqual(decoded, original);
  }
}