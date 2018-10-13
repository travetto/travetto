import { Util as BaseUtil } from '@travetto/base';
import { WordWrapper } from './wordwrap';

export class Serializer {
  static clean(key: string) {
    if (/['"@ -:]/.test(key)) {
      return key.includes('"') ?
        `'${key.replace(/[']/g, '\\\'')}'` :
        `"${key.replace(/["]/g, '\\\"')}"`;
    }
    return key;
  }

  static serialize(o: any, indent = 0) {
    let out = '';
    const prefix = ' '.repeat(indent);
    if (Array.isArray(o)) {
      for (const el of o) {
        out = `${out}\n${prefix}- ${this.serialize(el, indent + 2)}`;
      }
    } else if (BaseUtil.isPlainObject(o)) {
      for (const k of Object.keys(o)) {
        out = `${out}\n${prefix}${this.clean(k)}: ${this.serialize(o[k], indent + 2)}`;
      }
    } else if (typeof o === 'number' || typeof o === 'boolean' || o === null) {
      out = `${o}`;
    } else if (typeof o === 'string') {
      const lines = WordWrapper.wrap(o, 120);
      if (lines.length > 1) {
        out = [' |', ...lines].join(`${prefix}\n`);
      } else {
        out = lines[0];
      }
    }
    return out;
  }
}