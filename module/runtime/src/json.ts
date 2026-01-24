import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';

import type { Any } from './types.ts';

export type JSONParseInput = string | Buffer;

/**
 * JSON Utility functions
 */
export class JSONUtil {

  /**
   * Is valid input
   */
  static isValidInput(input: unknown): input is JSONParseInput {
    return typeof input === 'string' || Buffer.isBuffer(input);
  }

  /**
   * Parse JSON safely
   */
  static parseSafe<T>(input: JSONParseInput, reviver?: (this: unknown, key: string, value: Any) => unknown): T {
    if (typeof input !== 'string') {
      input = input.toString('utf8');
    }
    // TODO: Ensure we aren't vulnerable to prototype pollution
    return JSON.parse(input, reviver);
  }

  /**
   * Encode JSON value as buffer
   */
  static toBuffer<T>(value: T | undefined): Buffer {
    if (value === undefined) {
      return Buffer.alloc(0);
    }
    const text = JSON.stringify(value);
    return Buffer.from(text, 'utf8');
  }

  /**
   * Encode JSON value as base64 encoded string
   */
  static stringifyBase64<T>(value: T | undefined): string | undefined {
    const bytes = this.toBuffer(value);
    if (bytes.length === 0) {
      return undefined;
    }
    return bytes.toString('base64');
  }

  /**
   * Decode JSON value from base64 encoded string
   */
  static parseBase64<T>(input: string): T;
  static parseBase64<T>(input?: string | undefined): T | undefined;
  static parseBase64<T>(input?: string | undefined): T | undefined {
    if (!input) {
      return undefined;
    }

    let decoded = Buffer.from(input, 'base64').toString('utf8');

    // Read from encoded if it happens
    if (decoded.startsWith('%')) {
      decoded = decodeURIComponent(decoded);
    }

    return this.parseSafe(decoded);
  }

  /**
   * Read JSON file asynchronously
   * @param file
   * @returns
   */
  static async readFile<T>(file: string): Promise<T> {
    const content = await fs.readFile(file, 'utf8');
    return this.parseSafe(content);
  }

  /**
   * Read JSON file synchronously
   * @param file
   */
  static readFileSync<T>(file: string, onMissing?: T): T {
    if (!existsSync(file) && onMissing !== undefined) {
      return onMissing;
    }
    const content = readFileSync(file, 'utf8');
    return this.parseSafe(content);
  }
}