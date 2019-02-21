import { Block, ListBlock, MapBlock, TextBlock } from './type/block';
import { Node, TextNode } from './type/node';

export class State {
  blocks: Block[];
  top: Block;
  fields: [number, string][] = [];
  lines: [number, number][] = [];
  lineCount: number = 0;

  constructor(public text: string) {
    this.top = new ListBlock(-1);
    this.blocks = [this.top];
  }

  get indent() {
    return !this.top ? 0 : this.top.indent;
  }

  popToLevel(indent: number) {
    while (indent < this.top.indent) { // Block shift left
      this.endBlock();
      if (this.top.indent < 0) {
        throw new Error('Invalid indentation, could not find matching level');
      }
    }
  }

  popToTop() {
    let last;
    while (this.top.indent >= 0) {
      last = this.endBlock();
    }
    return last;
  }

  nestField(field: string, indent: number) {
    if (this.fields.length && this.fields[this.fields.length - 1][0] === indent) {
      this.fields[this.fields.length - 1][1] = field;
    } else {
      this.fields.push([indent, field]);
    }
  }

  startBlock(block: Block) {
    if (this.top instanceof TextBlock) {
      throw new Error(`Cannot nest in current block ${this.top.constructor.name}`);
    }
    this.top = block;
    this.blocks.push(block);
  }

  endBlock() {
    const ret = this.blocks.pop()!;
    this.top = this.blocks[this.blocks.length - 1];
    if (ret instanceof TextBlock || ret instanceof TextNode) {
      ret.value = ret.value.trimRight();
    }
    this.consumeNode(ret);
    return ret;
  }

  consumeNode(node: Node) {
    if (!this.top.consume) {
      throw new Error(`Cannot consume in current block ${this.top.constructor.name}`);
    }

    if (this.top instanceof MapBlock) {
      const [ind, field] = this.fields.pop()!;
      if ('indent' in node && this.top.indent !== ind) {
        throw new Error('Unable to set value, incorrect nesting');
      }
      this.top.consume(node, field);
    } else {
      this.top.consume!(node);
    }
  }

  readTextLine(tokens: string[], indent: number) {
    if (this.top instanceof TextBlock && (
      this.top.indent === undefined ||
      indent === this.top.indent ||
      tokens.length === 0
    )) {
      if (this.top.indent === undefined && tokens.length > 0) {
        this.top.indent = indent;
      }
      this.top.readLine(tokens);
      return true;
    } else if (tokens.length === 0) {
      return true;
    }
    return false;
  }

  buildError(message: string) {
    const [start, end] = this.lines[this.lineCount - 1];
    return new Error(`${message}, line: ${this.lineCount}\n${this.text.substring(start, end)}`);
  }
}