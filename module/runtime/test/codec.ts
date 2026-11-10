import assert from 'node:assert';
import { isUint8Array } from 'node:util/types';

import { AsyncIterableHelper, type BinaryStream, CodecUtil, castTo, RuntimeError } from '@travetto/runtime';
import { Suite, Test, TestFixtures } from '@travetto/test';

const addNewline = (input: string) => `${input}\n`;

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
    assert.throws(() => CodecUtil.fromHexString('abc'), RuntimeError);

    // Invalid hex string - non-hex characters
    assert.throws(() => CodecUtil.fromHexString('zzzz'), /Invalid hex string/);

    // Invalid hex string - contains invalid characters
    assert.throws(() => CodecUtil.fromHexString('12gh'), /Invalid hex string/);
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
    assert.throws(() => CodecUtil.fromBase64String('!!!invalid!!!'), RuntimeError);

    // Invalid base64 string - invalid character (@)
    assert.throws(() => CodecUtil.fromBase64String('aGVs@bG8='), /Invalid base64 string/);

    // Invalid base64 string - emoji
    assert.throws(() => CodecUtil.fromBase64String('hello😊world'), /Invalid base64 string/);
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
  verifyReadChunk() {
    const b1 = CodecUtil.readChunk('hello', 'latin1');
    assert(isUint8Array(b1));
    assert(new TextDecoder('latin1').decode(b1) === 'hello');

    const b2 = CodecUtil.readChunk(Buffer.from('world'));
    assert(Buffer.isBuffer(b2));
    assert(b2.toString() === 'world');

    const b3 = CodecUtil.readChunk(123);
    assert(isUint8Array(b3));
    assert(new TextDecoder('utf8').decode(b3) === '123');
  }

  @Test()
  verifyParseLineSimple() {
    assert.deepStrictEqual(CodecUtil.readCSVLine('a,b,c'), ['a', 'b', 'c']);
    assert.deepStrictEqual(CodecUtil.readCSVLine(' a , b , c '), ['a', 'b', 'c']);
    assert.deepStrictEqual(CodecUtil.readCSVLine('a,,c'), ['a', '', 'c']);
  }

  @Test()
  verifyParseLineCustomDelimiter() {
    assert.deepStrictEqual(CodecUtil.readCSVLine('col1\tcol2\tcol3', '\t'), ['col1', 'col2', 'col3']);
    assert.deepStrictEqual(CodecUtil.readCSVLine('1;2;3', ';'), ['1', '2', '3']);
  }

  @Test()
  verifyParseLineQuotedValues() {
    assert.deepStrictEqual(CodecUtil.readCSVLine('"a,b",c,"d,e"'), ['a,b', 'c', 'd,e']);
    assert.deepStrictEqual(CodecUtil.readCSVLine('"He said ""hello""",world'), ['He said "hello"', 'world']);
    assert.deepStrictEqual(CodecUtil.readCSVLine('a,"",c'), ['a', '', 'c']);
    assert.deepStrictEqual(CodecUtil.readCSVLine('"col\t1"\tcol2', '\t'), ['col\t1', 'col2']);
  }

  @Test()
  async verifyFromCSV() {
    const records = await AsyncIterableHelper.from(this.fixture.readBinaryStream('sample.csv'))
      .flatMap(CodecUtil.fromCSV<{ name: string; age: string; city: string }>())
      .toArray();

    assert.strictEqual(records.length, 3);
    assert.deepStrictEqual(records[0], { name: 'Alice', age: '30', city: 'Seattle' });
    assert.deepStrictEqual(records[1], { name: 'Bob', age: '25', city: 'New York, NY' });
    assert.deepStrictEqual(records[2], { name: 'Charlie "Chuck"', age: '40', city: 'Chicago' });
  }

  @Test()
  async verifyFromTSV() {
    const records = await AsyncIterableHelper.from(this.fixture.readBinaryStream('sample.tsv'))
      .flatMap(CodecUtil.fromCSV<{ id: string; title: string; score: string }>())
      .toArray();

    assert.strictEqual(records.length, 3);
    assert.deepStrictEqual(records[0], { id: '1', title: 'Alpha', score: '95' });
    assert.deepStrictEqual(records[1], { id: '2', title: 'Beta', score: '88' });
    assert.deepStrictEqual(records[2], { id: '3', title: 'Gamma', score: '100' });
  }

  @Test()
  async verifyFromCSVSynchronousWithBlankLines() {
    const lines = ['', 'name,age,city', '   ', 'Alice,30,Seattle', '', 'Bob,25,"New York, NY"', '   \t  ', 'Charlie,40,Chicago', ''].map(
      addNewline
    );
    const records = lines.flatMap<{ name: string; age: string; city: string }>(CodecUtil.fromCSV());

    assert.strictEqual(records.length, 3);
    assert.deepStrictEqual(records[0], { name: 'Alice', age: '30', city: 'Seattle' });
    assert.deepStrictEqual(records[1], { name: 'Bob', age: '25', city: 'New York, NY' });
    assert.deepStrictEqual(records[2], { name: 'Charlie', age: '40', city: 'Chicago' });

    const defaultRecords = lines.flatMap<object>(CodecUtil.fromCSV());

    assert.strictEqual(defaultRecords.length, 3);
    assert.deepStrictEqual(defaultRecords[0], { name: 'Alice', age: '30', city: 'Seattle' });
  }
}
