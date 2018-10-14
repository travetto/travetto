import { Node, TextNode, JSONNode, NumberNode, BooleanNode, NullNode } from './type/node';
import { TextBlock } from './type/block';

export class Tokenizer {

  static isComment = (ch: string, pos: number) => ch[pos] === '#' || (ch[pos] === '-' && ch[pos + 1] === '-' && ch[pos + 2] === '-');
  static isWhitespace = (ch: string) => ch[0] === ' ' || ch[0] === '\t' || ch[0] === '\n' || ch === '\r';

  static readQuote(text: string, pos: number, end: number) {
    const start = pos;
    const ch = text[pos++];
    while (text[pos] !== ch && pos < end) {
      pos += (text[pos] === '\\' ? 2 : 1);
    }
    if (pos === end) {
      throw new Error('Unterminated string literal');
    }
    return [pos, text.substring(start, pos + 1)] as [number, string];
  }

  static readJSON(text: string, pos: number = 0, end: number = text.length) {
    const start = pos;
    const stack = [text[pos] === '[' ? ']' : '}'];
    pos += 1;

    while (stack.length && pos < end) {
      const ch = text[pos];

      if (ch === stack[stack.length - 1]) {
        stack.pop();
      } else if (ch === '[' || ch === '{') {
        stack.push(ch === '[' ? ']' : '}');
      } else if (TextNode.isQuote(ch)) {
        [pos] = this.readQuote(text, pos, end);
      }
      pos += 1;
    }

    if (stack.length) {
      throw new Error('Invalid JSON');
    }

    return [pos, text.substring(start, pos)] as [number, string];
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
    if (lst && this.isComment(lst, 0)) {
      end -= 1;
    }
    lst = tokens[end - 1];
    if (lst && this.isWhitespace(lst)) {
      end -= 1;
    }

    return tokens.slice(start, end);
  }

  static tokenize(text: string, pos: number = 0, end: number = text.length) {
    const tokens: string[] = [];
    let token = '';

    let start = pos;

    end = Math.max(0, Math.min(end, text.length));

    const flushToken = () => {
      if (start !== pos) {
        tokens.push(text.substring(start, pos));
        start = pos;
      }
    };
    const pushToken = (ch: string) => { tokens.push(ch); start = pos + 1; };

    while (pos < end) {
      const ch = text[pos];
      if (TextNode.isQuote(ch)) {
        flushToken();
        [pos, token] = this.readQuote(text, pos, end);
        pushToken(token);
      } else if (ch === '[' || ch === '{') {
        flushToken();
        [pos, token] = this.readJSON(text, pos, end);
        pushToken(token);
      } else if (this.isComment(text, pos)) {
        break;
      } else if (ch === ':' || ch === '-') { // Special tokens
        flushToken();
        pushToken(ch);
      } else if (this.isWhitespace(ch)) {
        flushToken();
        const len = tokens.length - 1;

        if (len >= 0 && this.isWhitespace(tokens[len])) {
          tokens[len] += ch;
          start = pos + 1;
        } else {
          pushToken(ch);
        }
      }
      pos += 1;
    }

    pos = end;
    flushToken();
    return tokens;
  }

  static readValue(token: string): Node | undefined {
    switch (token.toLowerCase()) {
      case '': return;
      case 'yes': case 'no': case 'on': case 'off': case 'true': case 'false': return new BooleanNode(token);
      case 'null': return new NullNode();
    }
    switch (token[0]) {
      case '{': case '[': return new JSONNode(token);
      case '>': case '|': return new TextBlock(token[0] === '>' ? 'inline' : 'full');
    }

    const lastChar = token[token.length - 1]; // Optimize for simple checks
    if (lastChar >= '0' && lastChar <= '9' && /^[-]?(\d*[.])?\d+$/.test(token)) {
      return new NumberNode(token);
    }

    return new TextNode(token.trim());
  }
}