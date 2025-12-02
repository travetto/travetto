import { castTo } from '@travetto/runtime';
import { WhereClauseRaw } from '@travetto/model-query';

import { QueryLanguageTokenizer } from './tokenizer.ts';
import { Token, Literal, GroupNode, OP_TRANSLATION, ArrayNode, AllNode } from './types.ts';

/**
 * Determine if a token is boolean
 */
function isBoolean(o: unknown): o is Token & { type: 'boolean' } {
  return !!o && typeof o === 'object' && 'type' in o && o.type === 'boolean';
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
    const operation: Token & { value: string } = castTo(nodes.pop());
    const ident: Token & { value: string } = castTo(nodes.pop());

    // value isn't a literal or a list, bail
    if (value.type !== 'literal' && value.type !== 'list') {
      throw new Error(`Unexpected token: ${value.value}`);
    }

    // If operator is not an operator, bail
    if (operation.type !== 'operator') {
      throw new Error(`Unexpected token: ${operation.value}`);
    }

    // If operator is not known, bail
    const finalOp = OP_TRANSLATION[operation.value];

    if (!finalOp) {
      throw new Error(`Unexpected operator: ${operation.value}`);
    }

    nodes.push({
      type: 'clause',
      field: ident.value,
      operation: finalOp,
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
  static condense(nodes: (AllNode | Token)[], operation: 'and' | 'or'): void {
    let second = nodes[nodes.length - 2];

    while (isBoolean(second) && second.value === operation) {
      const right: AllNode = castTo(nodes.pop());
      nodes.pop()!;
      const left: AllNode = castTo(nodes.pop());
      const rg: GroupNode = castTo(right);
      if (rg.type === 'group' && rg.operation === operation) {
        rg.value.unshift(left);
        nodes.push(rg);
      } else {
        nodes.push({
          type: 'group',
          operation,
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
        operation: 'not',
        value: castTo<AllNode>(node)
      });
    }
  }

  /**
   * Parse all tokens
   */
  static parse(tokens: Token[], pos: number = 0): AllNode {

    let top: (AllNode | Token)[] = [];
    const stack: (typeof top)[] = [top];
    let arr: Literal[] | undefined;

    let token = tokens[pos];
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
            arr = [];
          } else {
            const arrNode: ArrayNode = { type: 'list', value: arr! };
            top.push(arrNode);
            arr = undefined;
            this.handleClause(top);
          }
          break;
        case 'literal':
          if (arr !== undefined) {
            arr.push(token.value);
          } else {
            top.push(token);
            this.handleClause(top);
          }
          break;
        case 'punctuation':
          if (!arr) {
            throw new Error(`Invalid token: ${token.value}`);
          }
          break;
        default:
          top.push(token);
      }
      token = tokens[++pos];
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
        return castTo({ [`$${node.operation!}`]: this.convert(node.value) });
      }
      case 'group': {
        return castTo({ [`$${node.operation!}`]: node.value.map(x => this.convert(x)) });
      }
      case 'clause': {
        const parts = node.field!.split('.');
        const top: WhereClauseRaw<T> = {};
        let sub: Record<string, unknown> = top;
        for (const p of parts) {
          sub = sub[p] = {};
        }
        if (node.operation === '$regex' && typeof node.value === 'string') {
          sub[node.operation!] = new RegExp(`^${node.value}`);
        } else if ((node.operation === '$eq' || node.operation === '$ne') && node.value === null) {
          sub.$exists = node.operation !== '$eq';
        } else if ((node.operation === '$in' || node.operation === '$nin') && !Array.isArray(node.value)) {
          throw new Error(`Expected array literal for ${node.operation}`);
        } else {
          sub[node.operation!] = node.value;
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