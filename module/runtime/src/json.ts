import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';

import { hasToJSON, type Any } from './types.ts';
import { BinaryUtil, type BinaryArray } from './binary.ts';

export type JSONParseInput = string | BinaryArray;

/**
 * JSON Utility functions
 */
export class JSONUtil {

  /**
   * Is valid input
   */
  static isValidInput(input: unknown): input is JSONParseInput {
    return typeof input === 'string' || BinaryUtil.isBinaryArray(input);
  }

  /**
   * Parse JSON safely
   */
  static parseSafe<T>(input: JSONParseInput, reviver?: (this: unknown, key: string, value: Any) => unknown): T {
    if (typeof input !== 'string') {
      input = BinaryUtil.toUTF8String(input);
    }
    // TODO: Ensure we aren't vulnerable to prototype pollution
    return JSON.parse(input, reviver);
  }

  /**
   * Encode JSON value as base64 encoded string
   */
  static stringifyBase64<T>(value: T | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    return BinaryUtil.utf8ToBase64(JSON.stringify(value));
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

    let decoded = BinaryUtil.base64ToUTF8(input);

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

  /**
   * Serialize with standard behavior
   */
  static serialize(body: unknown): string {
    let text: string;
    if (typeof body === 'string') {
      text = body;
    } else if (hasToJSON(body)) {
      text = JSON.stringify(body.toJSON());
    } else if (body instanceof Error) {
      text = JSON.stringify({ message: body.message });
    } else {
      text = JSON.stringify(body);
    }
    return text;
  }
}