import assert from 'node:assert';
import { isUint8Array } from 'node:util/types';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { castTo, CodecUtil, RuntimeError, type BinaryStream } from '@travetto/runtime';

@Suite()
export class CodecUtilTest {

  fixture = new TestFixtures();

  @Test()
  async verifyHexConversion() {
    const original = 'hello world';
    const hex = '68656c6c6f20776f726c64';

    const buffer = CodecUtil.fromHexString(hex);
    const decoder = new TextDecoder('utf8');
    assert.strictEqual(decoder.decode(buffer), original);

    const hexBack = CodecUtil.toHexString(Buffer.from(original));
    assert.strictEqual(hexBack, hex);
  }

  @Test()
  async verifyHexConversionErrors() {
    // Invalid hex string - odd length
    assert.throws(
      () => CodecUtil.fromHexString('abc'),
      RuntimeError
    );

    // Invalid hex string - non-hex characters
    assert.throws(
      () => CodecUtil.fromHexString('zzzz'),
      /Invalid hex string/
    );

    // Invalid hex string - contains invalid characters
    assert.throws(
      () => CodecUtil.fromHexString('12gh'),
      /Invalid hex string/
    );
  }

  @Test()
  async verifyBase64Conversion() {
    const original = 'hello world';
    const b64 = 'aGVsbG8gd29ybGQ=';

    const buffer = CodecUtil.fromBase64String(b64);
    const decoder = new TextDecoder('utf8');
    assert.strictEqual(decoder.decode(buffer), original);

    const b64Back = CodecUtil.toBase64String(Buffer.from(original));
    assert.strictEqual(b64Back, b64);
  }

  @Test()
  async verifyBase64ConversionErrors() {
    // Invalid base64 string - invalid characters (!)
    assert.throws(
      () => CodecUtil.fromBase64String('!!!invalid!!!'),
      RuntimeError
    );

    // Invalid base64 string - invalid character (@)
    assert.throws(
      () => CodecUtil.fromBase64String('aGVs@bG8='),
      /Invalid base64 string/
    );

    // Invalid base64 string - emoji
    assert.throws(
      () => CodecUtil.fromBase64String('hello😊world'),
      /Invalid base64 string/
    );
  }

  @Test()
  async verifyUTF8Conversion() {
    const original = 'hello world';
    const buffer = CodecUtil.fromUTF8String(original);
    assert.ok(isUint8Array(buffer));
    const decoder = new TextDecoder('utf8');
    assert.strictEqual(decoder.decode(buffer), original);

    const textBack = CodecUtil.toUTF8String(buffer);
    assert.strictEqual(textBack, original);
  }

  @Test()
  async verifyUTF8Base64RoundTrip() {
    const original = 'hello world';
    const b64 = CodecUtil.utf8ToBase64(original);
    const text = CodecUtil.base64ToUTF8(b64);
    assert.strictEqual(text, original);

    const b64Buf = CodecUtil.utf8ToBase64(Buffer.from(original));
    const textBuf = CodecUtil.base64ToUTF8(Buffer.from(b64Buf, 'base64'));
    assert.strictEqual(textBuf, original);
  }

  @Test()
  async verifyDetectEncoding() {
    const withEncoding: BinaryStream = castTo({ readableEncoding: 'utf8' });
    assert.strictEqual(CodecUtil.detectEncoding(withEncoding), 'utf8');

    const withoutEnc: BinaryStream = castTo({});
    assert.strictEqual(CodecUtil.detectEncoding(withoutEnc), undefined);
  }

  @Test()
  async verifyReadLines() {
    const lines = ['one', 'two', 'three'];
    async function* stream() {
      for (const line of lines) {
        yield CodecUtil.fromUTF8String(`${line}\n`);
      }
    }
    const collected: string[] = [];
    await CodecUtil.readLines(stream(), (line) => collected.push(line));
    assert.deepStrictEqual(collected, lines);
  }


  @Test()
  verifyReadChunk() {
    const b1 = CodecUtil.readUtf8Chunk('hello');
    assert(isUint8Array(b1));
    assert(new TextDecoder('utf8').decode(b1) === 'hello');

    const b2 = CodecUtil.readUtf8Chunk(Buffer.from('world'));
    assert(Buffer.isBuffer(b2));
    assert(b2.toString() === 'world');

    const b3 = CodecUtil.readUtf8Chunk(123);
    assert(isUint8Array(b3));
    assert(new TextDecoder('utf8').decode(b3) === '123');
  }
}