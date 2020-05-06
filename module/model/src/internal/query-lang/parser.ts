import { QueryLanguageTokenizer } from './tokenizer';
import { Node, Token, ClauseNode, UnaryNode, Literal, GroupNode, OP_TRANSLATION } from './types';

// TODO: Document
export class QueryLanguageParser {

  static handleClause(nodes: (Node | Token)[]) {
    const val = nodes.pop()! as Token;
    const op = nodes.pop()! as Token;
    const ident = nodes.pop()! as Token;

    if (val.type !== 'literal') {
      throw new Error(`Unexpected token: ${val.value}`);
    }

    if (op.type !== 'operator') {
      throw new Error(`Unexpected token: ${op.value}`);
    }

    const finalOp = OP_TRANSLATION[op.value as string];
    if (!finalOp) {
      throw new Error(`Unexpected operator: ${op.value}`);
    }

    nodes.push({
      type: 'clause',
      field: ident.value as string,
      op: finalOp,
      value: val.value as any
    } as ClauseNode);

    this.unary(nodes);
    this.condense(nodes, 'and');
  }

  static condense(nodes: (Node | Token)[], op: string) {
    let second = nodes[nodes.length - 2];
    while (second && second.type && second.type === 'boolean' && (second as any).value === op) {
      const right = nodes.pop()!;
      nodes.pop()!;
      const left = nodes.pop()!;
      const rg = right as GroupNode;
      if (rg.type === 'group' && rg.op === op) {
        rg.value.unshift(left);
        nodes.push(rg);
      } else {
        nodes.push({
          type: 'group',
          op,
          value: [left, right]
        } as GroupNode);
      }
      second = nodes[nodes.length - 2];
    }
  }

  static unary(nodes: (Node | Token)[]) {
    const second = nodes[nodes.length - 2] as Token;
    if (second && second.type === 'unary' && second.value === 'not') {
      const node = nodes.pop()!;
      nodes.pop();
      nodes.push({
        type: 'unary',
        op: 'not',
        value: node
      } as UnaryNode);
    }
  }

  static parse(tokens: Token[], pos: number = 0): Node {

    let top: (Node | Token)[] = [];
    const stack: (Node | Token)[][] = [top];
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
            top.push({ type: 'literal', value: arr } as any);
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

    return top[0];
  }

  static parseToQuery(text: string) {
    const tokens = QueryLanguageTokenizer.tokenize(text);
    const node = this.parse(tokens);
    return this.convert(node);
  }

  static convert(node: Node): any {
    switch (node.type) {
      case 'unary': {
        const un = node as GroupNode;
        return { [`$${un.op}`]: this.convert(un.value as any as GroupNode) };
      }
      case 'group': {
        const gn = node as GroupNode;
        return { [`$${gn.op}`]: gn.value.map(x => this.convert(x)) };
      }
      case 'clause': {
        const cn = node as ClauseNode;
        const parts = cn.field!.split('.');
        const top: any = {};
        let sub = top;
        for (const p of parts) {
          sub = sub[p] = {};
        }
        if (cn.op === '$regex' && typeof cn.value === 'string') {
          sub[cn.op!] = new RegExp(`^${cn.value}`);
        } else if ((cn.op === '$eq' || cn.op === '$ne') && cn.value === null) {
          sub.$exists = cn.op !== '$eq';
        } else if ((cn.op === '$in' || cn.op === '$nin') && !Array.isArray(cn.value)) {
          throw new Error(`Expected array literal for ${cn.op}`);
        } else {
          sub[cn.op!] = cn.value;
        }
        return top;
      }
      default: throw new Error(`Unexpected node type: ${node.type}`);
    }
  }
}