import { Node, TextNode, JSONNode, NumberNode, BooleanNode, NullNode } from './type/node';
import { TextBlock } from './type/block';

export class Tokenizer {

  static isComment = (ch: string, pos: number) => ch[pos] === '#' || (ch[pos] === '-' && ch[pos + 1] === '-' && ch[pos + 2] === '-');
  static isWhitespace = (ch: string) => ch[0] === ' ' || ch[0] === '\t' || ch[0] === '\n';
  static isQuote = (ch: string) => ch[0] === '"' || ch[0] === `'`;

  static readJSON(text: string, pos: number = 0, end: number = text.length) {
    if (!JSONNode.test(text[pos])) {
      throw new Error('Invalid JSON src');
    }
    const start = pos;
    const stack = [text[pos] === '[' ? ']' : '}'];
    pos += 1;

    while (stack.length && pos < end) {
      const ch = text[pos];
      pos += 1;

      if (ch === stack[stack.length - 1]) {
        stack.pop();
      } else if (ch === '[' || ch === '{') {
        stack.push(ch === '[' ? ']' : '}');
      } else if (this.isQuote(ch)) {
        while (text[pos] !== ch && pos < end) {
          if (ch === '\\') {
            pos += 1;
          }
          pos += 1;
        }
        if (pos === end) {
          throw new Error('Unterminated string literal');
        }
        pos += 1;
      }
    }

    if (stack.length) {
      throw new Error('Invalid JSON');
    }

    return [pos + 1, text.substring(start, pos)] as [number, string];
  }

  static getIndent(tokens: string[]) {
    return this.isWhitespace(tokens[0]) ? tokens[0].length : 0;
  }

  static cleanTokens(tokens: string[]) {
    let start = 0;
    let end = tokens.length;
    if (this.isWhitespace(tokens[0])) {
      start += 1;
    }

    // Remove trailing baggage
    let lst = tokens[end - 1] || '';
    if (lst && Tokenizer.isComment(lst, 0)) {
      end -= 1;
    }
    lst = tokens[end - 1];
    if (lst && Tokenizer.isWhitespace(lst)) {
      end -= 1;
    }

    return tokens.slice(start, end);
  }

  static tokenize(text: string, pos: number = 0, end: number = text.length) {
    const tokens: string[] = [];

    let start = pos;
    let quoted = [];
    let inQuote = '';

    end = Math.max(0, Math.min(end, text.length));

    const flush = () => {
      if (start !== pos) {
        tokens.push(text.substring(start, pos));
      }
      start = pos;
    };

    while (pos < end) {
      const ch = text[pos];
      if (inQuote) {
        if (text[pos] === '\\') {
          // Escape
          quoted.push(text[pos + 1]);
          pos += 1;
        } else if (this.isQuote(ch) && ch === inQuote) {
          // Done
          inQuote = '';
          tokens.push(quoted.join(''));
          quoted = [];
          start = pos + 1;
        } else {
          quoted.push(ch);
        }
      } else if (this.isQuote(ch)) {
        inQuote = ch;
        start = pos + 1;
      } else if (JSONNode.test(ch)) {
        flush();
        const [sub, subText] = this.readJSON(text, pos, end);
        tokens.push(subText);
        start = pos = sub;
      } else if (this.isComment(text, pos)) {
        break;
      } else if (ch === ':' || ch === '-') { // Special tokens
        flush();
        tokens.push(ch);
        start = pos + 1;
      } else if (this.isWhitespace(ch)) {
        flush();
        const len = tokens.length - 1;

        if (len >= 0 && this.isWhitespace(tokens[len])) {
          tokens[len] += ch;
        } else {
          tokens.push(ch);
        }
        start = pos + 1;
      }
      pos += 1;
    }

    if (inQuote) {
      throw new Error('Unterminated string literal');
    }

    pos = end;

    if (pos !== start) {
      tokens.push(text.substring(start, pos));
    }

    return tokens;
  }

  static readValue(token: string): Node | undefined {
    if (token === '') {
      return;
    }

    if (NullNode.test(token)) {
      return new NullNode();
    } else if (BooleanNode.test(token)) {
      return new BooleanNode(token);
    } else if (JSONNode.test(token)) {
      return new JSONNode(token);
    } else if (TextBlock.test(token)) {
      return new TextBlock(token);
    } else if (NumberNode.test(token)) {
      return new NumberNode(token);
    } else {
      return new TextNode(token.trim());
    }
  }
}