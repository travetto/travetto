import { Util } from '@travetto/base';

type SerializableType = Error & { stack?: any } | RegExp | Function | Set<any> | Map<string, any> | number | boolean | null | string | object;

/**
 * Handles serialization of object to YAML output
 */
export class Serializer {
  /**
   * Clean value, escaping as needed
   */
  static clean(key: string) {
    if (/[#'"@ \-:]/.test(key)) {
      return key.includes('"') ?
        `'${key.replace(/[']/g, '\\\'')}'` :
        `"${key.replace(/["]/g, '\\"')}"`;
    } else if (!key) {
      return `''`;
    } else {
      return key;
    }
  }

  /**
   * Perform word wrap on text, with a given width
   */
  static wordWrap(text: string, width: number = 120) {
    const lines: string[] = [];
    let line: string[] = [];
    let subl: number = 0;

    const push = (x: string) => { subl += x.length; line.push(x); };

    const flushLine = () => {
      if (line.length > 0) {
        lines.push(line.join('').trimRight());
      }
      line = [];
      subl = 0;
    };

    for (const sub of text.split(/\n/)) {
      if (sub.length < width) {
        push(sub);
      } else {
        const offset = sub.replace(/^(\s*)(.*)$/, (all, s) => s);
        push(offset);

        sub.trim().replace(/\S+(\s+|$)/g, part => {
          if (subl + part.length > width) {
            flushLine();
            push(offset);
          }
          push(part);

          return '';
        });
      }
      flushLine();
    }

    return lines;
  }

  /**
   * Serialize object with indentation and wordwrap support
   */
  static serialize(o: SerializableType, indent = 2, wordwrap = 120, indentLevel = 0) {
    let out = '';
    const prefix = ' '.repeat(indentLevel);
    if (o instanceof Error) {
      out = `${this.serialize(o.stack, indent, wordwrap, indentLevel + indent)}\n`;
    } else if (typeof o === 'function' || o instanceof RegExp || o instanceof Set || o instanceof Map) {
      if (Util.hasToJSON(o)) {
        out = this.serialize(o.toJSON(), indent, wordwrap, indentLevel);
      } else {
        throw new Error('Types are not supported');
      }
    } else if (Array.isArray(o)) {
      if (o.length) {
        out = o.map(el => `${prefix}-${this.serialize(el, indent, wordwrap, indentLevel + indent)}`).join('\n');
        if (indentLevel > 0) {
          out = `\n${out}`;
        }
      } else {
        out = ` []`;
      }
    } else if (typeof o === 'number' || typeof o === 'boolean' || o === null) {
      out = ` ${o}`;
    } else if (typeof o === 'string') {
      o = o.replace(/\t/g, prefix);
      const lines = this.wordWrap(o, wordwrap);
      if (lines.length > 1) {
        out = [' >', ...lines.map(x => `${prefix}${x}`)].join('\n');
      } else {
        out = ` ${this.clean(lines[0])}`;
      }
    } else if (o !== undefined) {
      const fin = o;
      out = (Object.keys(fin) as (keyof typeof fin)[])
        .filter(x => fin[x] !== undefined)
        .map(x => `${prefix}${this.clean(x)}:${this.serialize(fin[x], indent, wordwrap, indentLevel + indent)}`)
        .join('\n');
      if (indentLevel > 0) {
        out = `\n${out}`;
      }
    }
    return out;
  }
}