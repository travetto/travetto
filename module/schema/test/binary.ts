import type { Buffer, Blob, File } from 'node:buffer';
import assert from 'node:assert';
import type { Readable } from 'node:stream';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { Schema, SchemaRegistryIndex } from '@travetto/schema';
import type { BinaryArray, BinaryStream, BinaryType } from '@travetto/runtime';

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
}
