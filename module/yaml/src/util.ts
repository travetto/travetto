import { Node, TextBlock, TextNode, JSONNode, NumberNode, BooleanNode, NullNode } from './types';

export const TOKENS = {
  QUOTE_START: /^['"]/,
  COMMENT_START: /^(---|#)/,
  TEXT_BLOCK_START: /^[|>]/,
  BLANK_LINE: /^\s*$/,
  LIST_PREFIX: /^-/,
  FIELD_PREFIX: /^(([A-Za-z0-9_\-.]+)|('[^']+')|("[^"]+")):( )?/
};

export class Util {

  static readQuoted(text: string, full = true) {
    const quote = text.charAt(0);
    let nextPos: number;
    if (full) {
      if (text.charAt(text.length - 1) !== quote) {
        throw new Error('Unterminated string literal');
      }
      nextPos = text.length + 1;
      text = text.substring(1, text.lastIndexOf(quote));
      const qpos = text.indexOf(quote);
      if (qpos >= 0) {
        if (text.charAt(qpos - 1) !== '\\') {
          throw new Error('Invalid quote character in quoted string');
        }
      }
    } else {
      if (text.indexOf(quote, 1) < 0) {
        throw new Error('Unterminated string literal');
      }
      nextPos = text.indexOf(quote, 1) + 1;
      text = text.substring(1, nextPos - 1);
    }

    return [nextPos, text] as [number, string];
  }

  static readValue(line: string, indent: number): Node | undefined {
    if (line === '') {
      return;
    }

    let full = line;
    if (TOKENS.QUOTE_START.test(full)) {
      const [nextPos, val] = this.readQuoted(full);
      return new TextNode(val);
    } else {
      full = full.replace(/#.*$/, ''); // Remove comment
    }

    if (full === 'null') {
      return new NullNode();
    } else if (/^(true|false)$/i.test(full)) {
      return new BooleanNode(full);
    } else if (/^\d+([.]\d+)?$/.test(full)) {
      return new NumberNode(full);
    } else if (/^[\[\{]/.test(full)) {
      return new JSONNode(full);
    } else {

      if (TOKENS.TEXT_BLOCK_START.test(full)) {
        const tb = new TextBlock(indent);
        tb.subtype = full.charAt(0) === '>' ? 'inline' : 'full';
        return tb;
      } else {
        return new TextNode(full.trim());
      }
    }
  }

  static readLine(text: string, pos: number) {
    const og = pos;
    const tPos = text.indexOf('\n', pos);
    pos = tPos < 0 ? text.length + 1 : tPos + 1;

    const ret = text.substring(og, pos - 1);
    let indent = 0;
    while (/\s/.test(ret.charAt(indent))) {
      indent += 1;
    }
    return [pos, indent, ret.trim()] as [number, number, string];
  }

  static isPlainObject(obj: any): obj is { [key: string]: any } {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  static clean(key: string) {
    if (/['"@]/.test(key)) {
      if (key.indexOf('"') >= 0) {
        return `'${key.replace(/[']/g, '\\\'')}'`;
      } else {
        return `"${key.replace(/["]/g, '\\\"')}"`;
      }
    }
    return key;
  }

  static serialize(o: any, indent = 0) {
    let out = '';
    if (Array.isArray(o)) {
      for (const el of o) {
        out = `${out}\n${' '.repeat(indent)}- ${this.serialize(el, indent + 2)}`;
      }
    } else if (this.isPlainObject(o)) {
      for (const k of Object.keys(o)) {
        out = `${out}\n${' '.repeat(indent)}${this.clean(k)}: ${this.serialize(o[k], indent + 2)}`;
      }
    } else if (typeof o === 'number' || typeof o === 'boolean' || o === null) {
      out = `${o}`;
    } else if (typeof o === 'string') {
      const lines = o.split('\n');

      if (lines.length === 1 && lines[0].length < 60) {
        out = `${o}`;
      } else {
        const prefix = ' '.repeat(indent - 2);

        out = ` |`;
        for (const line of lines) {
          if (line.length < 60) {
            out = `${out}\n${prefix}${line}`;
          } else {
            const parts = line.split(' ');
            let i = 0;
            let subl = parts[i++];
            while (i < parts.length) {
              if (subl.length + parts[i].length > 60) {
                out = `${out}\n${prefix}${subl}`;
                subl = `${parts[i++]}`;
              } else {
                subl = `${subl} ${parts[i++]}`;
              }
            }
            if (subl) {
              out = `${out}\n${prefix}${subl}`;
            }
          }
          out = out.trimRight();
        }
      }
    }
    return out;
  }
}