export class Serializer {
  static clean(key: string) {
    if (/['"@ -:]/.test(key)) {
      return key.includes('"') ?
        `'${key.replace(/[']/g, '\\\'')}'` :
        `"${key.replace(/["]/g, '\\\"')}"`;
    }
    return key;
  }

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

  static serialize(o: any, indent = 2, wordwrap = 120, indentLevel = 0) {
    let out = '';
    const prefix = ' '.repeat(indentLevel);
    if (o instanceof Error) {
      out = `${this.serialize(o.stack, indent, wordwrap, indentLevel + indent)}\n`;
    } else if (typeof o === 'function' || o instanceof RegExp || o instanceof Set || o instanceof Map) {
      throw new Error('Types are not supported');
    } else if (Array.isArray(o)) {
      out = o.map(el => `${prefix}-${this.serialize(el, indent, wordwrap, indentLevel + indent)}`).join('\n');
      if (indentLevel > 0) {
        out = `\n${out}`;
      }
    } else if (typeof o === 'number' || typeof o === 'boolean' || o === null) {
      out = ` ${o}`;
    } else if (typeof o === 'string') {
      o = o.replace(/\t/g, prefix);
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