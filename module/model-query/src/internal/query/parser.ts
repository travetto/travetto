import { WhereClauseRaw } from '../../model/where-clause';
import { QueryLanguageTokenizer } from './tokenizer';
import { Token, Literal, GroupNode, OP_TRANSLATION, ArrayNode, AllNode } from './types';

/**
 * Determine if a token is boolean
 */
function isBoolean(o: unknown): o is Token & { type: 'boolean' } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !!o && (o as { type: string }).type === 'boolean';
}

/**
 * Language parser
 */
export class QueryLanguageParser {

  /**
   * Handle all clauses
   */
  static handleClause(nodes: (AllNode | Token)[]): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const val = nodes.pop()! as Token | ArrayNode;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const op = nodes.pop()! as Token;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const ident = nodes.pop()! as Token;

    // value isn't a literal or a list, bail
    if (val.type !== 'literal' && val.type !== 'list') {
      throw new Error(`Unexpected token: ${val.value}`);
    }

    // If operator is not an operator, bail
    if (op.type !== 'operator') {
      throw new Error(`Unexpected token: ${op.value}`);
    }

    // If operator is not known, bail
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const finalOp = OP_TRANSLATION[op.value as string];
    if (!finalOp) {
      throw new Error(`Unexpected operator: ${op.value}`);
    }

    nodes.push({
      type: 'clause',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      field: ident.value as string,
      op: finalOp,
      value: val.value
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
  static condense(nodes: (AllNode | Token)[], op: 'and' | 'or'): void {
    let second = nodes[nodes.length - 2];

    while (isBoolean(second) && second.value === op) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const right = nodes.pop()! as AllNode;
      nodes.pop()!;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const left = nodes.pop()! as AllNode;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const rg = right as GroupNode;
      if (rg.type === 'group' && rg.op === op) {
        rg.value.unshift(left);
        nodes.push(rg);
      } else {
        nodes.push({
          type: 'group',
          op,
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const second = nodes[nodes.length - 2] as Token;
    if (second && second.type === 'unary' && second.value === 'not') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const node = nodes.pop()! as AllNode;
      nodes.pop();
      nodes.push({
        type: 'unary',
        op: 'not',
        value: node
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
            top = stack[stack.length - 1];
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

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return top[0] as AllNode;
  }

  /**
   * Convert Query AST to output
   */
  static convert<T = unknown>(node: AllNode): WhereClauseRaw<T> {
    switch (node.type) {
      case 'unary': {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return { [`$${node.op!}`]: this.convert(node.value) } as WhereClauseRaw<T>;
      }
      case 'group': {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return { [`$${node.op!}`]: node.value.map(x => this.convert(x)) } as WhereClauseRaw<T>;
      }
      case 'clause': {
        const parts = node.field!.split('.');
        const top: WhereClauseRaw<T> = {};
        let sub: Record<string, unknown> = top;
        for (const p of parts) {
          sub = sub[p] = {};
        }
        if (node.op === '$regex' && typeof node.value === 'string') {
          sub[node.op!] = new RegExp(`^${node.value}`);
        } else if ((node.op === '$eq' || node.op === '$ne') && node.value === null) {
          sub.$exists = node.op !== '$eq';
        } else if ((node.op === '$in' || node.op === '$nin') && !Array.isArray(node.value)) {
          throw new Error(`Expected array literal for ${node.op}`);
        } else {
          sub[node.op!] = node.value;
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