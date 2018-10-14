export interface Node<T = any> {
  value: T;
}

export class TextNode implements Node<string> {
  static isQuote = (ch: string) => ch[0] === '"' || ch[0] === `'`;
  constructor(public value: string) {
    if (TextNode.isQuote(value)) {
      this.value = this.value.substring(1, this.value.length - 1).replace(new RegExp(`\\\\${value[0]}`, 'g'), value[0]);
    }
  }
}

export class NumberNode implements Node<number> {
  value: number;

  constructor(token: string) {
    this.value = token.includes('.') ? Number.parseFloat(token) : Number.parseInt(token, 10);
  }
}

export class BooleanNode implements Node<boolean> {
  value: boolean;

  constructor(token: string) {
    this.value = /yes|on|true/i.test(token);
  }
}

export class NullNode implements Node<null> {
  value: null = null;
}

export class JSONNode implements Node<any> {
  value: any;

  constructor(token: string) {
    this.value = JSON.parse(token);
  }
}