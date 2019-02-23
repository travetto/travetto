import { Tokenizer } from './tokenizer';

export class Serializer {
  static clean(key: string) {
    if (/['"@ -:]/.test(key)) {
      return key.includes('"') ?
        `'${key.replace(/[']/g, '\\\'')}'` :
        `"${key.replace(/["]/g, '\\\"')}"`;
    }
    return key;
  }

  static wordWrap(text: string, width: number = 160) {
    const lines: string[] = [];
    let line: string[] = [];
    let subl: number = 0;

    const pushLine = () => {
      if (line.length > 0) {
        lines.push(line.join('').replace(/\s+$/g, ''));
      }
      line = [];
      subl = 0;
    };

    text.replace(/\S+(\s+|$)/g, part => {
      if (part.startsWith('\n')) {
        line = [part];
        pushLine();
      } else {
        if (subl + part.length > width) {
          pushLine();
        }
        line.push(part);
        subl += part.length;
      }

      return '';
    });

    pushLine();
    return lines;
  }

  static serialize(o: any, indent = 2, wordwrap = 160, indentLevel = 0) {
    let out = '';
    const prefix = ' '.repeat(indentLevel);
    if (typeof o === 'function' || o instanceof RegExp || o instanceof Set || o instanceof Map) {
      throw new Error('Types are not supported');
    } else if (Array.isArray(o)) {
      out = o.map(el => `${prefix}-${this.serialize(el, indent, wordwrap, indentLevel + indent)}`).join('\n');
      if (indentLevel > 0) {
        out = `\n${out}`;
      }
    } else if (typeof o === 'number' || typeof o === 'boolean' || o === null) {
      out = ` ${o}`;
    } else if (typeof o === 'string') {
      o = o.replace(/\t/g, ' '.repeat(indentLevel));
      const lines = this.wordWrap(o, wordwrap);
      if (lines.length > 1) {
        out = [' >', ...lines.map(x => `${prefix}${x}`)].join('\n');
      } else {
        out = ` ${lines[0]}`;
      }
    } else {
      out = Object.keys(o)
        .map(x => `${prefix}${this.clean(x)}:${this.serialize(o[x], indent, wordwrap, indentLevel + indent)}`)
        .join('\n');
      if (indentLevel > 0) {
        out = `\n${out}`;
      }
    }
    return out;
  }
}