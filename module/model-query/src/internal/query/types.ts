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
export interface Node<T extends string = string> {
  type: T;
}

/**
 * Simple clause
 */
export interface ClauseNode extends Node<'clause'> {
  field?: string;
  op?: string;
  value?: Literal | Literal[];
}

/**
 * Grouping
 */
export interface GroupNode extends Node<'group'> {
  op?: 'and' | 'or';
  value: AllNode[];
}

/**
 * Unary node
 */
export interface UnaryNode extends Node<'unary'> {
  op?: 'not';
  value: AllNode;
}

/**
 * Array node
 */
export interface ArrayNode extends Node<'list'> {
  op?: 'not';
  value: Literal[];
}

export type AllNode = ArrayNode | UnaryNode | GroupNode | ClauseNode;

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
