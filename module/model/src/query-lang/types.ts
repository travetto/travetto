export type TokenType =
  'literal' | 'identifier' | 'boolean' |
  'operator' | 'grouping' | 'array' |
  'whitespace' | 'punctuation' | 'unary';

export interface TokenizeState {
  out: Token[];
  pos: number;
  start: number;
  text: string;
  mode: TokenType;
}

export type Literal = boolean | null | string | number | RegExp;

export interface Token {
  type: TokenType;
  value: Literal;
}

export interface Node {
  type: string;
}

export interface ClauseNode extends Node {
  type: 'clause';
  field?: string;
  op?: string;
  value?: Literal | Literal[];
}

export interface GroupNode extends Node {
  type: 'group';
  op?: 'and' | 'or';
  value: Node[];
}

export interface UnaryNode extends Node {
  type: 'unary';
  op?: 'not';
  value: Node;
}

export const OP_TRANSLATION: Record<string, string> = {
  '<': '$lt', '<=': '$lte',
  '>': '$gt', '>=': '$gte',
  '!=': '$ne', '==': '$eq',
  '~': '$regex', '!': '$not',
  in: '$in', 'not-in': '$nin'
};

export const VALID_OPS = new Set(Object.keys(OP_TRANSLATION));
