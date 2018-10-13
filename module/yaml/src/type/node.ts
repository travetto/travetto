export interface Node<T = any> {
  value: T;
}

export class TextNode implements Node<string> {
  constructor(public value: string) { }
}

export class NumberNode implements Node<number> {
  static test = (token: string) => /^\d+([.]\d+)?$/.test(token);

  value: number = 0;

  constructor(token: string) {
    if (token.includes('.')) {
      this.value = Number.parseFloat(token);
    } else {
      this.value = Number.parseInt(token, 10);
    }
  }
}

export class BooleanNode implements Node<boolean> {
  static MAPPING: { [key: string]: boolean } = {
    yes: true,
    no: false,
    on: true,
    off: false,
    true: true,
    false: false
  };

  static test = (token: string) => token.length < 6 && token.toLowerCase() in BooleanNode.MAPPING;

  value: boolean = false;

  constructor(token: string) {
    this.value = BooleanNode.MAPPING[token.toLowerCase()];
  }
}

export class NullNode implements Node<null> {
  static test = (token: string) => token === 'null';

  value: null = null;
}

export class JSONNode implements Node<any> {
  static test = (token: string) => token[0] === '[' || token[0] === '{';

  value: any;

  constructor(token: string) {
    this.value = JSON.parse(token);
  }
}