import { Token, TokenizeState, TokenType } from './types';

const OPEN_PARENS = 0x28, CLOSE_PARENS = 0x29, OPEN_BRACKET = 0x5b, CLOSE_BRACKET = 0x5d, COMMA = 0x2c;
const GREATER_THAN = 0x3e, LESS_THAN = 0x3c, EQUAL = 0x3d, NOT = 0x21, MODULO = 0x25, TILDE = 0x7e, AND = 0x26, OR = 0x7c;
const SPACE = 0x20, TAB = 0x09;
const DBL_QUOTE = 0x22, SGL_QUOTE = 0x27, FORWARD_SLASH = 0x2f, BACKSLASH = 0x5c;
const PERIOD = 0x2e, UNDERSCORE = 0x54, DOLLARSIGN = 0x24, DASH = 0x2d;

const ESCAPE: Record<string, string> = {
  '\\n': '\n',
  '\\r': '\r',
  '\\t': '\t',
  '\\"': '"',
  "\\'": "'"
};

/**
 * Mapping of keywords to node types and values
 */
const TOKEN_MAPPING: Record<string, Token> = {
  and: { type: 'boolean', value: 'and' },
  '&&': { type: 'boolean', value: 'and' },
  or: { type: 'boolean', value: 'or' },
  '||': { type: 'boolean', value: 'or' },
  in: { type: 'operator', value: 'in' },
  ['not-in']: { type: 'operator', value: 'not-in' },
  not: { type: 'unary', value: 'not' },
  '[': { type: 'array', value: 'start' },
  ']': { type: 'array', value: 'end' },
  '(': { type: 'grouping', value: 'start' },
  ')': { type: 'grouping', value: 'end' },
  null: { type: 'literal', value: null },
  true: { type: 'literal', value: true },
  false: { type: 'literal', value: false },
};

/**
 * Tokenizer for the query language
 */
export class QueryLanguageTokenizer {

  /**
   * Process the next token.  Can specify expected type as needed
   */
  static #processToken(state: TokenizeState, mode?: TokenType) {
    const text = state.text.substring(state.start, state.pos);
    const res = TOKEN_MAPPING[text.toLowerCase()];
    let value: unknown = text;
    if (!res && state.mode === 'literal') {
      if (/^["']/.test(text)) {
        value = text.substring(1, text.length - 1)
          .replace(/\\[.]/g, (a, b) => ESCAPE[a] || b);
      } else if (/^\//.test(text)) {
        const start = 1;
        const end = text.lastIndexOf('/');
        value = new RegExp(text.substring(start, end), text.substring(end + 1));
      } else if (/^\d+$/.test(text)) {
        value = parseInt(text, 10);
      } else if (/^\d+[.]\d+$/.test(text)) {
        value = parseFloat(text);
      } else {
        state.mode = 'identifier';
      }
    }
    return res ?? { value, type: state.mode || mode };
  }

  /**
   * Flush state to output
   */
  static #flush(state: TokenizeState, mode?: TokenType) {
    if ((!mode || !state.mode || mode !== state.mode) && state.start !== state.pos) {
      if (state.mode !== 'whitespace') {
        state.out.push(this.#processToken(state, mode));
      }
      state.start = state.pos;
    }
    state.mode = mode || state.mode;
  }

  /**
   * Determine if valid regex flag
   */
  static #isValidRegexFlag(ch: number) {
    return ch === 0x69 /* i */ || ch === 0x67 /* g */ || ch === 0x6D /* m */ || ch === 0x73 /* s */;
  }

  /**
   * Determine if valid token identifier
   */
  static #isValidIdentToken(ch: number) {
    return (ch >= 0x30 /* ZERO */ && ch <= 0x39 /* NINE */) ||
      (ch >= 0x41 /* A */ && ch <= 0x5a /* Z */) ||
      (ch >= 0x61 /* a */ && ch <= 0x7a /* z */) ||
      (ch === UNDERSCORE) ||
      (ch === DASH) ||
      (ch === DOLLARSIGN) ||
      (ch === PERIOD);
  }

  /**
   * Read string until quote
   */
  static readString(text: string, pos: number) {
    const len = text.length;
    const ch = text.charCodeAt(pos);
    const q = ch;
    pos += 1;
    while (pos < len) {
      if (text.charCodeAt(pos) === q) {
        break;
      } else if (text.charCodeAt(pos) === BACKSLASH) {
        pos += 1;
      }
      pos += 1;
    }
    if (pos === len && text.charCodeAt(pos) !== q) {
      throw new Error('Unterminated string literal');
    }
    return pos;
  }

  /**
   * Tokenize a text string
   */
  static tokenize(text: string): Token[] {
    const state: TokenizeState = {
      out: [] as Token[],
      pos: 0,
      start: 0,
      text,
      mode: undefined! as TokenType
    };
    const len = text.length;
    // Loop through each char
    while (state.pos < len) {
      // Read code as a number, more efficient
      const ch = text.charCodeAt(state.pos);
      switch (ch) {
        // Handle punctuation
        case OPEN_PARENS: case CLOSE_PARENS: case OPEN_BRACKET: case CLOSE_BRACKET: case COMMA:
          this.#flush(state);
          state.mode = 'punctuation';
          break;
        // Handle operator
        case GREATER_THAN: case LESS_THAN: case EQUAL:
        case MODULO: case NOT: case TILDE: case AND: case OR:
          this.#flush(state, 'operator');
          break;
        // Handle whitespace
        case SPACE: case TAB:
          this.#flush(state, 'whitespace');
          break;
        // Handle quotes and slashes
        case DBL_QUOTE: case SGL_QUOTE: case FORWARD_SLASH:
          this.#flush(state);
          state.mode = 'literal';
          state.pos = this.readString(text, state.pos) + 1;
          if (ch === FORWARD_SLASH) { // Read modifiers, not used by all, but useful in general
            while (this.#isValidRegexFlag(text.charCodeAt(state.pos))) {
              state.pos += 1;
            }
          }
          this.#flush(state);
          continue;
        // Handle literal
        default:
          if (this.#isValidIdentToken(ch)) {
            this.#flush(state, 'literal');
          } else {
            throw new Error(`Invalid character: ${text.substring(Math.max(0, state.pos - 10), state.pos + 1)}`);
          }
      }
      state.pos += 1;
    }

    this.#flush(state);

    return state.out;
  }
}