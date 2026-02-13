import { isUint8Array, isUint16Array, isUint32Array, isArrayBuffer } from 'node:util/types';
import { type Class, type BinaryArray, type BinaryType, type BinaryStream, BinaryUtil, toConcrete } from '@travetto/runtime';

const Special = Symbol();

type SchemaTypeConfig = {
  /**
   * Controls how inbound data is typed
   */
  bind?(input: unknown): undefined | unknown;
  /**
   * Controls how provided data is validated
   */
  validate?(input: unknown): string | undefined;
  /**
   * Override for the name type
   */
  name?: string;
};

/**
 * Utility for managing schema type configuration
 */
export class SchemaTypeUtil {
  static {
    this.#register(String, value => typeof value === 'string', 'string');
    this.#register(Number, value => typeof value === 'number', 'number');
    this.#register(BigInt, value => typeof value === 'bigint', 'bigint');
    this.#register(Boolean, value => typeof value === 'boolean', 'boolean');
    this.#register(Date, value => value instanceof Date && !Number.isNaN(value.getTime()));
    this.#register(Buffer, Buffer.isBuffer);
    this.#register(Uint8Array, isUint8Array);
    this.#register(Uint16Array, isUint16Array);
    this.#register(Uint32Array, isUint32Array);
    this.#register(ArrayBuffer, isArrayBuffer);
    this.#register(toConcrete<BinaryType>(), BinaryUtil.isBinaryType);
    this.#register(toConcrete<BinaryArray>(), BinaryUtil.isBinaryArray);
    this.#register(toConcrete<BinaryStream>(), BinaryUtil.isBinaryStream);
  }

  static #register(type: Class | Function, fn: (value: unknown) => boolean, name?: string): void {
    this.setSchemaTypeConfig(type, {
      validate: (item: unknown) => fn(item) ? undefined : 'type', name
    });
  }

  static getSchemaTypeConfig(cls: Class | Function): SchemaTypeConfig | undefined {
    return Object.getOwnPropertyDescriptor(cls, Special)?.value;
  }

  static setSchemaTypeConfig(cls: Class | Function, config: SchemaTypeConfig): void {
    Object.defineProperty(cls, Special, { value: config });
  }
}
