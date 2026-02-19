import { Injectable } from '@travetto/di';

import type { ConfigData, ConfigParser } from './types.ts';

const BACKSLASH = '\\'.charCodeAt(0);
const EQUALS = '='.charCodeAt(0);
const COLON = ':'.charCodeAt(0);
const HASH = '#'.charCodeAt(0);
const EXCL = '!'.charCodeAt(0);

@Injectable()
export class PropertiesConfigParser implements ConfigParser {

  static parseLine(text: string): [key: string, value: string] | undefined {
    if (text.charCodeAt(0) === HASH || text.charCodeAt(0) === EXCL) {
      return;
    }
    const key: number[] = [];
    let value: string | undefined;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text.charCodeAt(i);
      if (ch === EQUALS || ch === COLON) { // Break
        value = text.substring(i + 1).trimStart();
        break;
      } else if (ch === BACKSLASH) {
        key.push(text.charCodeAt(i += 1));
      } else {
        key.push(ch);
      }
    }
    if (value) {
      return [String.fromCharCode(...key).trimEnd(), value];
    }
  }

  ext = ['.properties'];

  parse(text: string): ConfigData {
    const out: ConfigData = {};
    const lines = text.split(/\n/g);

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      while (i < lines.length && line.endsWith('\\')) {
        line = `${line.replace(/[\\]$/, '')}${lines[i += 1].trimStart()}`;
      }
      const entry = PropertiesConfigParser.parseLine(line);
      if (entry) {
        out[entry[0]] = entry[1];
      }
    }
    return out;
  }
}