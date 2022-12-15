import { Util } from '@travetto/base';

type SerializableType = (Error & { stack: SerializableType }) | RegExp | Function | Set<unknown> | Map<string, unknown> | number | boolean | null | string | object;
type SerializeConfig = {
  indent: number;
  wordwrap: number;
};

/**
 * Handles serialization of object to YAML output
 */
export class Serializer {
  /**
   * Clean value, escaping as needed
   */
  static clean(key: string): string {
    if (/[#'"@ \-:{}]/.test(key)) {
      return key.includes('"') ?
        `'${key.replace(/[']/g, '\\\'')}'` :
        `"${key.replace(/["]/g, '\\"')}"`;
    } else if (!key) {
      return "''";
    } else {
      return key;
    }
  }

  /**
   * Perform word wrap on text, with a given width
   */
  static wordWrap(text: string, width: number = 120): string[] {
    const lines: string[] = [];
    let line: string[] = [];
    let runningLength: number = 0;

    const push = (x: string): void => { runningLength += x.length; line.push(x); };

    const flushLine = (): void => {
      if (line.length > 0) {
        lines.push(line.join('').trimEnd());
      }
      line = [];
      runningLength = 0;
    };

    for (const sub of text.split(/\n/)) {
      if (sub.length < width) {
        push(sub);
      } else {
        const offset = sub.replace(/^(\s*)(.*)$/, (all, s) => s);
        push(offset);

        sub.trim().replace(/\S+(\s+|$)/g, part => {
          if (runningLength + part.length > width) {
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
  static serialize(o: SerializableType, config: Partial<SerializeConfig> = {}, indentLevel = 0): string {
    const cfg = { indent: 2, wordwrap: 120, ...config };
    let out = '';
    const prefix = ' '.repeat(indentLevel);
    if (o instanceof Date) {
      out = this.serialize(o.toISOString(), cfg, indentLevel);
    } else if (o instanceof Error) {
      out = `${this.serialize(o.stack, cfg, indentLevel + cfg.indent)}\n`;
    } else if (typeof o === 'function' || o instanceof RegExp) {
      if (Util.hasToJSON(o)) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        out = this.serialize(o.toJSON() as object, cfg, indentLevel);
      } else if (o instanceof Function) {
        out = this.serialize(o.Ⲑid ?? o.name, cfg, indentLevel);
      } else {
        throw new Error(`Types are not supported: ${typeof o}`);
      }
    } else if (o instanceof Set) {
      return this.serialize([...o], config, indentLevel);
    } else if (o instanceof Map) {
      return this.serialize(Object.fromEntries(o.entries()), config, indentLevel);
    } else if (Array.isArray(o)) {
      if (o.length) {
        out = o.map(el => `${prefix}-${this.serialize(el, cfg, indentLevel + cfg.indent)}`).join('\n');
        if (indentLevel > 0) {
          out = `\n${out}`;
        }
      } else {
        out = ' []';
      }
    } else if (typeof o === 'number' || typeof o === 'boolean' || o === null) {
      out = ` ${o}`;
    } else if (typeof o === 'string') {
      o = o.replace(/\t/g, prefix);
      const lines = this.wordWrap(o, cfg.wordwrap);
      if (lines.length > 1) {
        out = [' >', ...lines.map(x => `${prefix}${x}`)].join('\n');
      } else {
        out = ` ${this.clean(lines[0])}`;
      }
    } else if (o !== undefined) {
      const fin = o;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const keys = Object.keys(fin) as (keyof typeof fin)[];
      if (keys.length) {
        out = keys
          .filter(x => fin[x] !== undefined)
          .map(x => `${prefix}${this.clean(x)}:${this.serialize(fin[x], cfg, indentLevel + cfg.indent)}`)
          .join('\n');
        if (indentLevel > 0) {
          out = `\n${out}`;
        }
      } else {
        out = ' {}';
      }
    }
    return out;
  }
}