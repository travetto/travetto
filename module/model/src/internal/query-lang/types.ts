/**
 * Supported token types
 */
export type TokenType =
  'literal' | 'identifier' | 'boolean' |
  'operator' | 'grouping' | 'array' |
  'whitespace' | 'punctuation' | 'unary';

/**
 * Tokenization state
 */
export interface TokenizeState {
  out: Token[];
  pos: number;
  start: number;
  text: string;
  mode: TokenType;
}

/**
 * Literal types
 */
export type Literal = boolean | null | string | number | RegExp | Date;

/**
 * Token
 */
export interface Token {
  type: TokenType;
  value: Literal;
}

/**
 * Base AST Node
 */
export interface Node {
  type: string;
}

/**
 * Simple clause
 */
export interface ClauseNode extends Node {
  type: 'clause';
  field?: string;
  op?: string;
  value?: Literal | Literal[];
}

/**
 * Grouping
 */
export interface GroupNode extends Node {
  type: 'group';
  op?: 'and' | 'or';
  value: Node[];
}

/**
 * Unary node
 */
export interface UnaryNode extends Node {
  type: 'unary';
  op?: 'not';
  value: Node;
}

/**
 * Array node
 */
export interface ArrayNode extends Node {
  type: 'list';
  op?: 'not';
  value: Literal[];
}

/**
 * Translation of operators to model query keys
 */
export const OP_TRANSLATION: Record<string, string> = {
  '<': '$lt', '<=': '$lte',
  '>': '$gt', '>=': '$gte',
  '!=': '$ne', '==': '$eq',
  '~': '$regex', '!': '$not',
  in: '$in', 'not-in': '$nin'
};

export const VALID_OPS = new Set(Object.keys(OP_TRANSLATION));
