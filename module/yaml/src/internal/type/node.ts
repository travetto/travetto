import { SimpleType } from './common';

export interface Node<T extends SimpleType = SimpleType> {
  value: T;
}

export class TextNode implements Node<string> {
  constructor(public value: string) {
    const ch = value.charCodeAt(0);
    if (ch === 0x22 /* dbl quote*/ || ch === 0x27 /* sgl quote */) {
      this.value = this.value.substring(1, this.value.length - 1).replace(new RegExp(`\\\\${value[0]}`, 'g'), value[0]);
    }
    this.value = this.value
      .replaceAll('\\n', '\n')
      .replaceAll('\\t', '\t')
      .replaceAll('\\r', '\r');
  }
}

export class NumberNode implements Node<number> {
  value: number;

  constructor(token: string) {
    this.value = token.includes('.') ? parseFloat(token) : parseInt(token, 10);
    if (Number.isNaN(this.value)) {
      throw new Error(`Invalid numeric input: ${token}`);
    }
  }
}

export class BooleanNode implements Node<boolean> {
  value: boolean;

  constructor(token: string) {
    this.value = /^(yes|on|1|true)/i.test(token);
  }
}

export class NullNode implements Node<null> {
  value: null = null;
}

export class JSONNode implements Node {
  value: SimpleType;

  constructor(token: string) {
    this.value = JSON.parse(token);
  }
}