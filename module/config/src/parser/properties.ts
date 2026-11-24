import { Injectable } from '@travetto/di';
import { CodecUtil, type UnknownRecord } from '@travetto/runtime';

import type { ConfigParser } from './types.ts';

const BACKSLASH_CHAR = '\\';
const BACKSLASH = BACKSLASH_CHAR.charCodeAt(0);
const EQUALS = '='.charCodeAt(0);
const COLON = ':'.charCodeAt(0);
const HASH = '#'.charCodeAt(0);
const EXCLAMATION = '!'.charCodeAt(0);

@Injectable()
export class PropertiesConfigParser implements ConfigParser {
  static parseLine(text: string): [key: string, value: string] | undefined {
    if (text.charCodeAt(0) === HASH || text.charCodeAt(0) === EXCLAMATION) {
      return;
    }
    const key: number[] = [];
    let value: string | undefined;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text.charCodeAt(i);
      if (ch === EQUALS || ch === COLON) {
        // Break
        value = text.substring(i + 1).trimStart();
        break;
      } else if (ch === BACKSLASH) {
        key.push(text.charCodeAt((i += 1)));
      } else {
        key.push(ch);
      }
    }
    if (value) {
      return [String.fromCharCode(...key).trimEnd(), value];
    }
  }

  static parseLines(text: string): UnknownRecord {
    const out: UnknownRecord = {};
    const output: string[] = [];
    for (const line of CodecUtil.readLines(Buffer.alloc(0), `${text}\n`).lines) {
      output.push((output.length ? line.trimStart() : line).replace(/\\$/, ''));

      if (!line.endsWith(BACKSLASH_CHAR)) {
        const entry = PropertiesConfigParser.parseLine(output.splice(0, output.length).join(''));
        if (entry) {
          out[entry[0]] = entry[1];
        }
      }
    }
    return out;
  }

  ext = ['.properties'];

  parse(text: string): UnknownRecord {
    return PropertiesConfigParser.parseLines(text);
  }
}
