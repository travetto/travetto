import type { SimpleObject, SimpleType } from './common';
import { Node } from './node';

export interface Block<T extends SimpleType = SimpleType> extends Node<T> {
  indent: number;
  consume?(node: Node, ...extra: unknown[]): void;
}

export class TextBlock implements Block<string> {
  value = '';
  indent: number;

  constructor(public subtype: 'inline' | 'full') { }

  readLine(tokens: string[]): void {
    if (tokens.length === 0) { // New line
      if (this.subtype === 'inline') {
        if (this.value.endsWith(' ')) {
          this.value = this.value.replace(/ $/, '\n');
        } else {
          this.value += (this.value.endsWith('\n') ? '\n' : ' ');
        }
      } else {
        this.value += '\n';
      }
    } else {
      const toAdd = tokens.join('').trimEnd()
        .replaceAll('\\n', '\n')
        .replaceAll('\\t', '\t')
        .replaceAll('\\r', '\r');
      this.value += toAdd + (this.subtype === 'full' ? '\n' : ' ');
    }
  }
}

export class ListBlock implements Block<SimpleType[]> {
  constructor(public indent: number, public value: SimpleType[] = []) { }

  consume(node: Node): void {
    this.value.push(node.value);
  }
}

export class MapBlock implements Block<SimpleObject> {
  constructor(public indent: number, public value: SimpleObject = {}) { }

  consume(node: Node, key: string): void {
    this.value[key] = node.value;
  }
}
