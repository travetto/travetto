import { castTo } from '@travetto/runtime';
import type { WhereClauseRaw } from '@travetto/model-query';

import { QueryLanguageTokenizer } from './tokenizer.ts';
import { type Token, type Literal, type GroupNode, OPERATOR_TRANSLATION, type ArrayNode, type AllNode } from './types.ts';

/**
 * Determine if a token is boolean
 */
function isBoolean(value: unknown): value is Token & { type: 'boolean' } {
  return !!value && typeof value === 'object' && 'type' in value && value.type === 'boolean';
}

/**
 * Language parser
 */
export class QueryLanguageParser {

  /**
   * Handle all clauses
   */
  static handleClause(nodes: (AllNode | Token)[]): void {
    const value: Token | ArrayNode = castTo(nodes.pop());
    const operator: Token & { value: string } = castTo(nodes.pop());
    const identifier: Token & { value: string } = castTo(nodes.pop());

    // value isn't a literal or a list, bail
    if (value.type !== 'literal' && value.type !== 'list') {
      throw new Error(`Unexpected token: ${value.value}`);
    }

    // If operator is not an operator, bail
    if (operator.type !== 'operator') {
      throw new Error(`Unexpected token: ${operator.value}`);
    }

    // If operator is not known, bail
    const finalOperation = OPERATOR_TRANSLATION[operator.value];

    if (!finalOperation) {
      throw new Error(`Unexpected operator: ${operator.value}`);
    }

    nodes.push({
      type: 'clause',
      field: identifier.value,
      operator: finalOperation,
      value: value.value
    });

    // Handle unary support
    this.unary(nodes);
    // Simplify as we go along
    this.condense(nodes, 'and');
  }

  /**
   * Condense nodes to remove unnecessary groupings
   * (a AND (b AND (c AND d))) => (a AND b AND c)
   */
  static condense(nodes: (AllNode | Token)[], operator: 'and' | 'or'): void {
    let second = nodes[nodes.length - 2];

    while (isBoolean(second) && second.value === operator) {
      const right: AllNode = castTo(nodes.pop());
      nodes.pop()!;
      const left: AllNode = castTo(nodes.pop());
      const rightGroup: GroupNode = castTo(right);
      if (rightGroup.type === 'group' && rightGroup.operator === operator) {
        rightGroup.value.unshift(left);
        nodes.push(rightGroup);
      } else {
        nodes.push({
          type: 'group',
          operator,
          value: [left, right]
        });
      }
      second = nodes[nodes.length - 2];
    }
  }

  /**
   * Remove unnecessary unary nodes
   * (((5))) => 5
   */
  static unary(nodes: (AllNode | Token)[]): void {
    const second = nodes[nodes.length - 2];
    if (second && second.type === 'unary' && second.value === 'not') {
      const node = nodes.pop();
      nodes.pop(); // This is second
      nodes.push({
        type: 'unary',
        operator: 'not',
        value: castTo<AllNode>(node)
      });
    }
  }

  /**
   * Parse all tokens
   */
  static parse(tokens: Token[], position: number = 0): AllNode {

    let top: (AllNode | Token)[] = [];
    const stack: (typeof top)[] = [top];
    let list: Literal[] | undefined;

    let token = tokens[position];
    while (token) {
      switch (token.type) {
        case 'grouping':
          if (token.value === 'start') {
            stack.push(top = []);
          } else {
            const group = stack.pop()!;
            top = stack.at(-1)!;
            this.condense(group, 'or');
            top.push(group[0]);
            this.unary(top);
            this.condense(top, 'and');
          }
          break;
        case 'array':
          if (token.value === 'start') {
            list = [];
          } else {
            const arrNode: ArrayNode = { type: 'list', value: list! };
            top.push(arrNode);
            list = undefined;
            this.handleClause(top);
          }
          break;
        case 'literal':
          if (list !== undefined) {
            list.push(token.value);
          } else {
            top.push(token);
            this.handleClause(top);
          }
          break;
        case 'punctuation':
          if (!list) {
            throw new Error(`Invalid token: ${token.value}`);
          }
          break;
        default:
          top.push(token);
      }
      token = tokens[++position];
    }

    this.condense(top, 'or');

    return castTo(top[0]);
  }

  /**
   * Convert Query AST to output
   */
  static convert<T = unknown>(node: AllNode): WhereClauseRaw<T> {
    switch (node.type) {
      case 'unary': {
        return castTo({ [`$${node.operator!}`]: this.convert(node.value) });
      }
      case 'group': {
        return castTo({ [`$${node.operator!}`]: node.value.map(value => this.convert(value)) });
      }
      case 'clause': {
        const parts = node.field!.split('.');
        const top: WhereClauseRaw<T> = {};
        let sub: Record<string, unknown> = top;
        for (const part of parts) {
          sub = sub[part] = {};
        }
        if (node.operator === '$regex' && typeof node.value === 'string') {
          sub[node.operator!] = new RegExp(`^${node.value}`);
        } else if ((node.operator === '$eq' || node.operator === '$ne') && node.value === null) {
          sub.$exists = node.operator !== '$eq';
        } else if ((node.operator === '$in' || node.operator === '$nin') && !Array.isArray(node.value)) {
          throw new Error(`Expected array literal for ${node.operator}`);
        } else {
          sub[node.operator!] = node.value;
        }
        return top;
      }
      default: throw new Error(`Unexpected node type: ${node.type}`);
    }
  }

  /**
   * Tokenize and parse text
   */
  static parseToQuery<T = unknown>(text: string): WhereClauseRaw<T> {
    const tokens = QueryLanguageTokenizer.tokenize(text);
    const node = this.parse(tokens);
    return this.convert(node);
  }
}