import { Block, Node, ListBlock, MapBlock } from './types';

export class State {
  blocks: Block[] = [];
  top: Block;
  fields: [number, string][] = [];

  constructor() {
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

  nestField(field: string, indent: number) {
    if (this.fields.length && this.fields[this.fields.length - 1][0] === indent) {
      this.fields[this.fields.length - 1][1] = field;
    } else {
      this.fields.push([indent, field]);
    }
  }

  startBlock(block: Block) {
    if (!this.top.canNest) {
      throw new Error(`Cannot nest in current block ${this.top.type}`);
    }
    this.top = block;
    this.blocks.push(block);
  }

  endBlock() {
    const ret = this.blocks.pop()!;
    this.top = this.blocks[this.blocks.length - 1];
    this.consumeNode(ret);
    return ret;
  }

  consumeNode(node: Node) {
    if (!this.top.consume) {
      throw new Error(`Cannot consume in current block ${this.top.type}`);
    }

    if (this.top instanceof MapBlock) {
      const [ind, field] = this.fields.pop()!;
      if ('indent' in node && this.top.indent !== ind) {
        console.log(node, [ind, field]);
        throw new Error('Unable to set value, incorrect nesting');
      }
      this.top.consume(node, field);
    } else {
      this.top.consume!(node);
    }
  }
}