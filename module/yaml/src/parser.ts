import { State } from './state';
import { ListBlock, MapBlock, TextBlock } from './types';
import { Util, TOKENS } from './util';

export class Parser {

  pos = 0;
  lineCount = 0;
  lines: string[] = [];
  state = new State();

  constructor(public text: string) { }

  private readTextLines(line: string, indent: number) {
    if (this.state.top instanceof TextBlock && (indent === this.state.top.indent || TOKENS.BLANK_LINE.test(line))) {
      if (this.state.top.subtype === 'full' && this.state.top.value) {
        this.state.top.value += '\n';
      }
      this.state.top.value += (line || '\n');
      return true;
    }

    return false;
  }

  private readLine(nextPos?: number) {
    return Util.readLine(this.text, nextPos === undefined ? this.pos : nextPos);
  }

  private startList(indent: number) {
    this.pos += 1;

    if (indent === this.state.top.indent) {
      if (!(this.state.top instanceof ListBlock)) {
        throw new Error('Invalid mixing of elements');
      }
    } else {
      this.state.startBlock(new ListBlock(indent));
    }
  }

  private startMap(line: string, indent: number) {
    let field: string;
    let anchor: number;
    if (TOKENS.QUOTE_START.test(line)) {
      [, field] = Util.readQuoted(line, false);
      anchor = line.indexOf(':', field.length) + 1;
    } else {
      anchor = line.indexOf(':') + 1;
      field = line.substring(0, anchor - 1);
    }
    this.pos += anchor + 1;

    this.state.nestField(field, indent);

    if (indent === this.state.top.indent) {
      if (!(this.state.top instanceof MapBlock)) {
        throw new Error('Invalid mixing of elements');
      }
    } else {
      this.state.startBlock(new MapBlock(indent));
    }
  }

  private readText(line: string, indent: number, nextLine: number) {
    const res = Util.readValue(line, indent);
    if (res) {
      if (res instanceof TextBlock) {
        const [p, i, t] = this.readLine(nextLine);
        res.indent = i;
        this.state.startBlock(res);
      } else {
        this.state.consumeNode(res);
      }
    }
  }

  private _parse() {
    // Loop Lines
    while (this.pos < this.text.length) {
      this.lineCount += 1;

      const [nextLinePos, indent, line] = this.readLine();

      this.lines.push(line);

      // Eat lines
      if (TOKENS.COMMENT_START.test(line) || this.readTextLines(line, indent)) {
        this.pos = nextLinePos;
        continue;
      }

      this.state.popToLevel(indent);

      let subIndent = 0;
      let subLine = '';
      let subPos;
      const lineStart = this.pos;

      // Process single line
      while (this.pos < nextLinePos) {
        [subPos, subIndent, subLine] = this.readLine();
        this.pos += subIndent;
        subIndent = this.pos - lineStart;

        if (TOKENS.LIST_PREFIX.test(subLine)) {
          this.startList(subIndent);
        } else if (TOKENS.FIELD_PREFIX.test(subLine)) {
          this.startMap(subLine, subIndent);
        } else {
          this.readText(subLine, subIndent, nextLinePos);
          break;
        }
      }
      this.pos = nextLinePos;
    }

    this.state.popToLevel(0);

    return this.state.top!.value;
  }

  parse() {
    try {
      return this._parse();
    } catch (e) {
      throw new Error(`${e.message}, line: ${this.lineCount}\n${this.lines[this.lineCount - 1]}`);
    }
  }
}