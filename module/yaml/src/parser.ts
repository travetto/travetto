import { State } from './state';
import { ListBlock, MapBlock, TextBlock } from './type/block';
import { Tokenizer } from './tokenizer';
import { TextNode } from './type/node';

export class Parser {

  pos = 0;
  lineCount = 0;
  lines: string[] = [];
  state = new State();

  constructor(public text: string) { }

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

  private startMap(field: string, indent: number) {
    this.state.nestField(new TextNode(field).value, indent);

    if (indent === this.state.top.indent) {
      if (!(this.state.top instanceof MapBlock)) {
        throw new Error('Invalid mixing of elements');
      }
    } else {
      this.state.startBlock(new MapBlock(indent));
    }
  }

  private readLine() {
    const nlPos = this.text.indexOf('\n', this.pos);
    const nextLineStart = nlPos < 0 ? this.text.length + 1 : nlPos + 1;
    let tokens = Tokenizer.tokenize(this.text, this.pos, nextLineStart);
    const indent = Tokenizer.getIndent(tokens);

    if (indent) {
      tokens.shift(); // Drop leading space
    }

    const line = this.text.substring(this.pos, nextLineStart - 1);
    this.lines.push(line);

    if (this.state.readTextLine(tokens, indent)) {
      return [nextLineStart] as [number];
    }

    tokens = Tokenizer.cleanTokens(tokens);

    return [nextLineStart, indent, tokens] as [number, number, string[]];
  }

  private _parse() {
    // Loop Lines
    while (this.pos < this.text.length) {
      this.lineCount += 1;

      const res = this.readLine();

      if (res.length === 1) {
        this.pos = res[0];
        continue;
      }

      const [nextLineStart, indent, tokens] = res;
      this.state.popToLevel(indent);

      let subIndent = indent;
      let pending: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const lastToken = i === tokens.length - 1;
        const isEndOrSpace = (lastToken || Tokenizer.isWhitespace(tokens[i + 1]));

        if (pending.length === 0 && token === '-' && isEndOrSpace) {
          this.startList(subIndent);
          subIndent += token.length;
          if (!lastToken) { // Consume whitespace
            i += 1;
            subIndent += tokens[i].length;
          }
        } else if (pending.length === 1 && token === ':' && isEndOrSpace) {
          this.startMap(pending[0], subIndent);
          subIndent += pending[0].length + token.length;
          if (!lastToken) {  // Consume whitespace
            i += 1;
            subIndent += tokens[i].length;
          }
          pending = [];
        } else {
          pending.push(token);
        }
      }

      // What to do
      if (pending.length) {
        const node = Tokenizer.readValue(pending.join(''))!;
        if (node instanceof TextBlock) {
          this.state.startBlock(node);
        } else {
          this.state.consumeNode(node);
        }
      }
      this.pos = nextLineStart;
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