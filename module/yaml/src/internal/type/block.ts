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

  readLine(tokens: string[]) {
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
      this.value += tokens.join('').trimRight() + (this.subtype === 'full' ? '\n' : ' ');
    }
  }
}

export class ListBlock implements Block<SimpleType[]> {
  constructor(public indent: number, public value: SimpleType[] = []) { }

  consume(node: Node) {
    this.value.push(node.value);
  }
}

export class MapBlock implements Block<SimpleObject> {
  constructor(public indent: number, public value: SimpleObject = {}) { }

  consume(node: Node, key: string) {
    this.value[key] = node.value;
  }
}
