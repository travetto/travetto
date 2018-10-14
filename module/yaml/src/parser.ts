import { State } from './state';
import { ListBlock, MapBlock, TextBlock } from './type/block';
import { Tokenizer } from './tokenizer';
import { TextNode } from './type/node';

const DASH = '-';
const COLON = ':';

export class Parser {

  private static startList(state: State, indent: number) {
    if (indent === state.top.indent) {
      if (!(state.top instanceof ListBlock)) {
        throw new Error('Invalid mixing of elements');
      }
    } else {
      state.startBlock(new ListBlock(indent));
    }
  }

  private static startMap(state: State, field: string, indent: number) {
    state.nestField(new TextNode(field).value, indent);

    if (indent === state.top.indent) {
      if (!(state.top instanceof MapBlock)) {
        throw new Error('Invalid mixing of elements');
      }
    } else {
      state.startBlock(new MapBlock(indent));
    }
  }

  private static readLine(state: State, text: string, pos: number) {
    const nlPos = text.indexOf('\n', pos);
    const nextLineStart = nlPos < 0 ? text.length + 1 : nlPos + 1;
    let tokens = Tokenizer.tokenize(text, pos, nextLineStart);
    const indent = Tokenizer.getIndent(tokens);

    if (indent) {
      tokens.shift(); // Drop leading space
    }

    state.lines.push([pos, nextLineStart - 1]);

    if (state.readTextLine(tokens, indent)) {
      return [nextLineStart] as [number];
    }

    tokens = Tokenizer.cleanTokens(tokens);

    return [nextLineStart, indent, tokens] as [number, number, string[]];
  }

  static parseRaw(state: State) {
    let pos = 0;
    const text = state.text;

    // Loop Lines
    const end = text.length;
    while (pos < end) {
      state.lineCount += 1;

      const res = Parser.readLine(state, text, pos);

      if (res.length === 1) {
        pos = res[0];
        continue;
      }

      const [nextLineStart, indent, tokens] = res;
      state.popToLevel(indent);

      let subIndent = indent;
      const pending: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const lastToken = i === tokens.length - 1;
        const isEndOrSpace = (lastToken || Tokenizer.isWhitespaceStr(tokens[i + 1]));

        if (pending.length === 0 && token === DASH && isEndOrSpace) {
          Parser.startList(state, subIndent);
          subIndent += token.length + 1;
          if (!lastToken) { // Consume whitespace
            i += 1;
          }
        } else if (pending.length === 1 && token === COLON && isEndOrSpace) {
          Parser.startMap(state, pending[0], subIndent);
          subIndent += pending[0].length;
          if (!lastToken) {  // Consume whitespace
            i += 1;
          }
          subIndent += token.length;
          pending.shift();
        } else {
          pending.push(token);
        }
      }

      // What to do
      if (pending.length) {
        const node = Tokenizer.readValue(pending.join(''))!;
        if (node instanceof TextBlock) {
          state.startBlock(node);
        } else {
          state.consumeNode(node);
        }
      }
      pos = nextLineStart;
    }

    state.popToLevel(0);

    return state.top!.value;
  }

  static parse(text: string) {
    const state = new State(text);
    try {
      return this.parseRaw(state);
    } catch (e) {
      throw state.buildError(e.message);
    }
  }
}