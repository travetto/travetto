import assert from 'node:assert';
import { Readable, PassThrough } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { buffer } from 'node:stream/consumers';

import { Test, Suite } from '@travetto/test';
import {
  BinaryUtil, toConcrete, type BinaryArray,
  type BinaryStream, type BinaryType, type BinaryContainer
} from '@travetto/runtime';

@Suite()
export class BinaryUtilTest {

  @Test()
  verifyIsBinaryConstructor() {
    assert(BinaryUtil.isBinaryTypeReference(Readable));
    assert(BinaryUtil.isBinaryTypeReference(Buffer));
    assert(BinaryUtil.isBinaryTypeReference(Blob));
    assert(BinaryUtil.isBinaryTypeReference(File));
    assert(BinaryUtil.isBinaryTypeReference(Uint8Array));
    assert(BinaryUtil.isBinaryTypeReference(Uint16Array));
    assert(BinaryUtil.isBinaryTypeReference(Uint32Array));
    assert(BinaryUtil.isBinaryTypeReference(Uint8ClampedArray));
    assert(BinaryUtil.isBinaryTypeReference(toConcrete<BinaryArray>()));
    assert(BinaryUtil.isBinaryTypeReference(toConcrete<BinaryStream>()));
    assert(BinaryUtil.isBinaryTypeReference(toConcrete<BinaryContainer>()));
    assert(BinaryUtil.isBinaryTypeReference(toConcrete<BinaryType>()));
    assert(!BinaryUtil.isBinaryTypeReference(String));
    assert(!BinaryUtil.isBinaryTypeReference(Number));
  }

  @Test()
  verifyIsBinaryArray() {
    assert(BinaryUtil.isBinaryArray(Buffer.alloc(5)));
    assert(BinaryUtil.isBinaryArray(new Uint8Array(5)));
    assert(BinaryUtil.isBinaryArray(new Uint16Array(5)));
    assert(BinaryUtil.isBinaryArray(new Uint32Array(5)));
    assert(BinaryUtil.isBinaryArray(new ArrayBuffer(5)));
    assert(!BinaryUtil.isBinaryArray([1, 2, 3]));
    assert(!BinaryUtil.isBinaryArray('hello'));
  }

  @Test()
  verifyIsBinaryStream() {
    assert(BinaryUtil.isBinaryStream(new Readable()));
    assert(BinaryUtil.isBinaryStream(new ReadableStream()));

    // Async iterator
    const asyncIter = {
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: true, value: undefined })
        };
      }
    };
    assert(BinaryUtil.isBinaryStream(asyncIter));

    assert(!BinaryUtil.isBinaryStream(Buffer.alloc(5)));
  }

  @Test()
  verifyIsBinaryContainer() {
    assert(BinaryUtil.isBinaryContainer(new Blob([])));
    assert(BinaryUtil.isBinaryContainer(new File([], 'test.txt')));
    assert(!BinaryUtil.isBinaryContainer(Buffer.alloc(5)));
  }

  @Test()
  verifyIsBinaryType() {
    assert(BinaryUtil.isBinaryType(Buffer.alloc(5)));
    assert(BinaryUtil.isBinaryType(new Readable()));
    assert(BinaryUtil.isBinaryType(new Blob([])));
    assert(!BinaryUtil.isBinaryType(null));
    assert(!BinaryUtil.isBinaryType(undefined));
    assert(!BinaryUtil.isBinaryType('string'));
  }

  @Test()
  verifyArrayToBuffer() {
    const input = new Uint8Array([1, 2, 3]);
    const buf = BinaryUtil.binaryArrayToBuffer(input);
    assert(Buffer.isBuffer(buf));
    assert(buf.length === 3);
    assert(buf[0] === 1);

    const input32 = new Uint32Array([2 ** 31 - 1]);
    const buf32 = BinaryUtil.binaryArrayToBuffer(input32);
    assert(Buffer.isBuffer(buf32));
    assert(buf32.length === input32.byteLength);
    assert(buf32.equals(Buffer.from(input32.buffer)));

    const buf2 = BinaryUtil.binaryArrayToBuffer(Buffer.from([4, 5]));
    assert(Buffer.isBuffer(buf2));
    assert(buf2[0] === 4);

    const ab = new ArrayBuffer(2);
    const view = new Uint8Array(ab);
    view[0] = 6;
    view[1] = 7;
    const buf3 = BinaryUtil.binaryArrayToBuffer(ab);
    assert(Buffer.isBuffer(buf3));
    assert(buf3[0] === 6);
  }

  @Test()
  async verifyToBinaryArray() {
    // Array
    const arr = await BinaryUtil.toBinaryArray(new Uint8Array([1, 2]));
    assert(arr instanceof Uint8Array);
    assert(arr[0] === 1);

    // Stream
    const stream = Readable.from(Buffer.from([3, 4]));
    const arr2 = await BinaryUtil.toBinaryArray(stream);
    assert(Buffer.isBuffer(arr2));
    assert(arr2[0] === 3);

    // Blob
    const blob = new Blob([new Uint8Array([5, 6])]);
    const arr3 = await BinaryUtil.toBinaryArray(blob);
    assert(arr3 instanceof ArrayBuffer);
    const view = new Uint8Array(arr3);
    assert(view[0] === 5);
  }

  @Test()
  async verifyToBuffer() {
    const blob = new Blob(['hello']);
    const buf = await BinaryUtil.toBuffer(blob);
    assert(Buffer.isBuffer(buf));
    assert(buf.toString() === 'hello');
  }

  @Test()
  async verifyToReadable() {
    // Buffer
    const buf = Buffer.from('hello');
    const r1 = BinaryUtil.toReadableStream(buf);
    assert(r1 instanceof ReadableStream);
    assert((await buffer(r1)).toString() === 'hello');

    // Blob
    const blob = new Blob(['world']);
    const r2 = BinaryUtil.toReadableStream(blob);
    assert(r2 instanceof ReadableStream);
    assert((await buffer(r2)).toString() === 'world');

    // ReadableStream
    const rs = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([65]));
        controller.close();
      }
    });
    const r3 = BinaryUtil.toReadableStream(rs);
    assert(r3 instanceof ReadableStream);
    assert((await buffer(r3)).toString() === 'A');
  }

  @Test()
  async verifyToBinaryStream() {
    const input = Buffer.from('test');
    const stream = BinaryUtil.toBinaryStream(input);
    assert(stream instanceof ReadableStream);

    const stream2 = Readable.from('test2');
    assert(BinaryUtil.toBinaryStream(stream2) === stream2);
  }

  @Test()
  verifyCombineBinaryArrays() {
    const b1 = Buffer.from('hel');
    const b2 = new Uint8Array([108, 111]); // 'lo'
    const combined = BinaryUtil.combineBinaryArrays([b1, b2]);
    assert(combined.toString() === 'hello');
  }

  @Test()
  verifySliceByteArray() {
    const buf = Buffer.from('hello world');
    assert(BinaryUtil.sliceByteArray(buf, 0, 5).toString() === 'hello');

    const u8 = new Uint8Array([1, 2, 3, 4, 5]);
    const sliced = BinaryUtil.sliceByteArray(u8, 1, 3);
    assert(sliced.byteLength === 2);
    const resolved = BinaryUtil.binaryArrayToBuffer(sliced);
    assert(resolved[0] === 2);
    assert(resolved[1] === 3);
  }

  @Test()
  async verifyPipeline() {
    const input = Buffer.from('pipeline test');
    const output = new PassThrough();
    const finished = BinaryUtil.pipeline(input, output);

    const result = await buffer(output);
    await finished;

    assert(result.toString() === 'pipeline test');
  }

  @Test()
  verifyMakeBinaryArray() {
    const arr = BinaryUtil.makeBinaryArray(5, 65);
    assert(Buffer.isBuffer(arr));
    assert(arr.length === 5);
    assert(arr.toString() === 'AAAAA');
  }

  @Test()
  async verifyToSynchronous() {
    // Direct value
    const v1 = BinaryUtil.toSynchronous(Buffer.from('test'));
    assert(Buffer.isBuffer(v1));

    // Function returning value
    const v2 = BinaryUtil.toSynchronous(() => Buffer.from('test2'));
    assert(Buffer.isBuffer(v2));

    // Function returning promise
    const v4 = BinaryUtil.toSynchronous(async () => Buffer.from('test4'));
    assert(v4 instanceof Readable);
    assert((await buffer(v4)).toString() === 'test4');
  }
}
