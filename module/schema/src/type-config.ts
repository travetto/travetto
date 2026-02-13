import { isUint8Array, isUint16Array, isUint32Array, isArrayBuffer } from 'node:util/types';
import { Readable } from 'node:stream';

import { type Class, type BinaryArray, type BinaryType, type BinaryStream, BinaryUtil, toConcrete } from '@travetto/runtime';

type SchemaTypeConfig = {
  /**
   * Controls how inbound data is typed
   */
  bind?(input: unknown): undefined | unknown;
  /**
   * Controls how provided data is validated
   */
  validate?(input: unknown): string | undefined;
};

/**
 * Utility for managing schema type configuration
 */
export class SchemaTypeUtil {
  static cache = new Map<Function, SchemaTypeConfig>();

  static {
    // Primitive Types
    this.register(Date, value => value instanceof Date && !Number.isNaN(value.getTime()));
    // Binary Types
    this.register(Buffer, Buffer.isBuffer);
    this.register(Uint8Array, isUint8Array);
    this.register(Uint16Array, isUint16Array);
    this.register(Uint32Array, isUint32Array);
    this.register(ArrayBuffer, isArrayBuffer);
    this.register(ReadableStream, value => value instanceof ReadableStream);
    this.register(Readable, value => value instanceof Readable);
    this.register(toConcrete<BinaryType>(), BinaryUtil.isBinaryType);
    this.register(toConcrete<BinaryArray>(), BinaryUtil.isBinaryArray);
    this.register(toConcrete<BinaryStream>(), BinaryUtil.isBinaryStream);
    this.register(Blob, value => value instanceof Blob);
    this.register(File, value => value instanceof File);
  }

  static register(type: Class | Function, fn: (value: unknown) => boolean): void {
    SchemaTypeUtil.setSchemaTypeConfig(type, {
      validate: (item: unknown) => fn(item) ? undefined : 'type'
    });
  }

  static getSchemaTypeConfig(type: Function): SchemaTypeConfig | undefined {
    return this.cache.get(type);
  }

  static setSchemaTypeConfig(type: Function, config: SchemaTypeConfig): void {
    this.cache.set(type, config);
  }
}
