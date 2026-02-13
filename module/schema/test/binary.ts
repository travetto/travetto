import { Buffer, Blob, File } from 'node:buffer';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { Schema, SchemaRegistryIndex, SchemaValidator, type ValidationError, ValidationResultError } from '@travetto/schema';
import { type BinaryArray, type BinaryStream, type BinaryType, castTo } from '@travetto/runtime';

@Schema()
class BinaryTestContainer {

  notString: string;
  notBoolean: boolean;
  notNumber: number;

  buffer: Buffer;
  blob: Blob;
  file: File;
  webStream: ReadableStream;
  stream: Readable;
  arrayBuffer: ArrayBuffer;
  globalBuffer: globalThis.Buffer;
  globalBlob: globalThis.Blob;
  globalFile: globalThis.File;
  globalWebStream: globalThis.ReadableStream;
  globalStream: NodeJS.ReadableStream;

  data: BinaryStream;
  byteArray: BinaryArray;
  type: BinaryType;

  unit8Array: Uint8Array;
  unit16Array: Uint16Array;
  unit32Array: Uint32Array;
}

@Suite()
class BinaryTest {

  findError(errors: ValidationError[], path: string) {
    return errors.some(x => x.path === path);
  }

  @BeforeAll()
  ready() {
    return Registry.init();
  }

  @Test()
  async testRegister() {
    const config = SchemaRegistryIndex.get(BinaryTestContainer);

    for (const [key, field] of Object.entries(config.getFields())) {
      if (field.name.startsWith('not')) {
        assert(!field.binary, `Field ${key} is incorrectly marked as binary`);
      } else {
        assert(field.binary, `Field ${key} is not marked as binary`);
      }
    }
  }

  buildBinaryPayload() {
    const buffer = Buffer.from([1, 2, 3]);
    const blob = new Blob([new Uint8Array([4, 5])], { type: 'application/octet-stream' });
    const file = new File([new Uint8Array([6, 7])], 'test.bin', { type: 'application/octet-stream' });
    const webStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([8, 9]));
        controller.close();
      }
    });
    const stream = Readable.from([Buffer.from([10, 11])]);
    const arrayBuffer = new Uint8Array([12, 13]).buffer;

    return BinaryTestContainer.from({
      notString: 'ok',
      notBoolean: true,
      notNumber: 42,

      buffer,
      blob,
      file,
      webStream,
      stream,
      arrayBuffer,
      globalBuffer: Buffer.from([14, 15]),
      globalBlob: new Blob([new Uint8Array([16, 17])], { type: 'application/octet-stream' }),
      globalFile: new File([new Uint8Array([18, 19])], 'global.bin', { type: 'application/octet-stream' }),
      globalWebStream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([20]));
          controller.close();
        }
      }),
      globalStream: Readable.from([Buffer.from([21])]),

      data: castTo<Readable>(Readable.from([Buffer.from([22])])),
      byteArray: castTo<Uint16Array>(new Uint16Array([23, 24])),
      type: castTo<Buffer>(Buffer.from([25])),

      unit8Array: new Uint8Array([26, 27]),
      unit16Array: new Uint16Array([28, 29]),
      unit32Array: new Uint32Array([30, 31])
    });
  }

  @Test()
  testBindBinaryTypes() {
    const bound = this.buildBinaryPayload();

    assert(Buffer.isBuffer(bound.buffer));
    assert(bound.blob instanceof Blob);
    assert(bound.file instanceof File);
    assert(bound.webStream instanceof ReadableStream);
    assert(bound.stream instanceof Readable);
    assert(bound.arrayBuffer instanceof ArrayBuffer);

    assert(Buffer.isBuffer(bound.globalBuffer));
    assert(bound.globalBlob instanceof Blob);
    assert(bound.globalFile instanceof File);
    assert(bound.globalWebStream instanceof ReadableStream);
    assert(bound.globalStream instanceof Readable);

    assert(bound.data instanceof Readable);
    assert(bound.byteArray instanceof Uint16Array);
    assert(Buffer.isBuffer(bound.type));

    assert(bound.unit8Array instanceof Uint8Array);
    assert(bound.unit16Array instanceof Uint16Array);
    assert(bound.unit32Array instanceof Uint32Array);
  }

  @Test()
  async testValidateBinaryTypes() {
    const payload = this.buildBinaryPayload();
    const validated = await SchemaValidator.validate(BinaryTestContainer, payload);

    assert(Buffer.isBuffer(validated.buffer));
    assert(validated.blob instanceof Blob);
    assert(validated.file instanceof File);
    assert(validated.webStream instanceof ReadableStream);
    assert(validated.stream instanceof Readable);
    assert(validated.arrayBuffer instanceof ArrayBuffer);

    assert(Buffer.isBuffer(validated.globalBuffer));
    assert(validated.globalBlob instanceof Blob);
    assert(validated.globalFile instanceof File);
    assert(validated.globalWebStream instanceof ReadableStream);
    assert(validated.globalStream instanceof Readable);

    assert(validated.data instanceof Readable);
    assert(validated.byteArray instanceof Uint16Array);
    assert(Buffer.isBuffer(validated.type));

    assert(validated.unit8Array instanceof Uint8Array);
    assert(validated.unit16Array instanceof Uint16Array);
    assert(validated.unit32Array instanceof Uint32Array);
  }

  @Test()
  async testValidateWrongTypes() {
    const payload = this.buildBinaryPayload();
    const payload2 = Object.assign(payload, {
      buffer: castTo<Buffer>(new Uint16Array([1, 2, 3])),
      unit16Array: castTo<Uint16Array>(Buffer.from([4, 5])),
      webStream: castTo<ReadableStream>(new Blob([new Uint8Array([6, 7])], { type: 'application/octet-stream' }))
    });

    await assert.rejects(
      () =>
        SchemaValidator.validate(BinaryTestContainer, payload2),
      e => e instanceof ValidationResultError &&
        this.findError(e.details.errors, 'buffer') &&
        this.findError(e.details.errors, 'unit16Array') &&
        this.findError(e.details.errors, 'webStream')
    );
  }
}
