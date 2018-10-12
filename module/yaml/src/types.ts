export interface Node<T = any> {
  type: string;
  value: T;
}

export interface Block<T = any> extends Node<T> {
  indent: number;
  canNest: boolean;
  consume?(node: Node<any>, ...extra: any[]): void;
}

export class TextBlock implements Block<string> {
  type = 'text';
  subtype: 'inline' | 'full';
  value = '';
  canNest = false;

  constructor(public indent: number) { }
}

export class ListBlock implements Block<Node[]> {
  type = 'list';
  value: Node[] = [];
  canNest = true;

  constructor(public indent: number) { }

  consume(node: Node<any>) {
    this.value.push(node.value);
  }
}

export class MapBlock implements Block<{ [key: string]: Node }> {
  type = 'map';
  value: { [key: string]: Node } = {};
  canNest = true;

  constructor(public indent: number) { }

  consume(node: Node<any>, key: string) {
    this.value[key] = node.value;
  }
}

export class TextNode implements Node<string> {
  type = 'string';
  value: string = '';

  constructor(text: string) {
    this.value = text;
  }
}

export class NumberNode implements Node<number> {
  type = 'number';
  value: number = 0;

  constructor(line: string) {
    if (line.includes('.')) {
      this.value = Number.parseFloat(line);
    } else {
      this.value = Number.parseInt(line, 10);
    }
  }
}

export class BooleanNode implements Node<boolean> {
  type = 'boolean';
  value: boolean = false;

  constructor(line: string) {
    this.value = /^(yes|true|on)$/i.test(line);
  }
}

export class NullNode implements Node<null> {
  type = 'null';
  value: null = null;
}

export class JSONNode implements Node<any> {
  type = 'json';
  value: any;

  constructor(line: string) {
    this.value = JSON.parse(line);
  }
}