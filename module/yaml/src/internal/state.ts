import { Block, ListBlock, MapBlock, TextBlock } from './type/block';
import { Node, TextNode } from './type/node';

/**
 * Parser state
 */
export class State {
  /**
   * Current stack of blocks in process
   */
  blocks: Block[];
  /**
   * Current block
   */
  top: Block;
  /**
   * Collected fields so far
   */
  fields: [number, string][] = [];
  /**
   * Collected lines
   */
  lines: [number, number][] = [];
  /**
   * Line count
   */
  lineCount: number = 0;

  constructor(public text: string) {
    this.top = new ListBlock(-1);
    this.blocks = [this.top];
  }

  /**
   * Get active block identifier
   */
  get indent() {
    return !this.top ? 0 : this.top.indent;
  }

  /**
   * Keep popping states until indentation request is satisfied
   */
  popToLevel(indent: number) {
    while (indent < this.top.indent) { // Block shift left
      this.endBlock();
      if (this.top.indent < 0) {
        throw this.buildError('Invalid indentation, could not find matching level');
      }
    }
  }

  /**
   * Keep popping states until at the top of the document
   */
  popToTop() {
    let last;
    while (this.top.indent >= 0) {
      last = this.endBlock();
    }
    return last ?? { index: 0, value: {} }; // Default to empty object if nothing returned
  }

  /**
   * Start sub item with a given field name and indentation
   */
  nestField(field: string, indent: number) {
    if (this.fields.length && this.fields[this.fields.length - 1][0] === indent) {
      this.fields[this.fields.length - 1][1] = field;
    } else {
      this.fields.push([indent, field]);
    }
  }

  /**
   * Start a new block
   */
  startBlock(block: Block) {
    if (this.top instanceof TextBlock) {
      throw this.buildError(`Cannot nest in current block ${this.top.constructor.name}`);
    }
    this.top = block;
    this.blocks.push(block);
  }

  /**
   * Complete a block
   */
  endBlock() {
    const ret = this.blocks.pop()!;
    this.top = this.blocks[this.blocks.length - 1];
    if (ret instanceof TextBlock || ret instanceof TextNode) {
      ret.value = ret.value.trimRight();
    }
    this.consumeNode(ret);
    return ret;
  }

  /**
   * Include node in output content, popping as needed
   */
  consumeNode(node: Node) {
    if (!this.top.consume) {
      throw this.buildError(`Cannot consume in current block ${this.top.constructor.name}`);
    }

    if (this.top instanceof MapBlock) {
      const [ind, field] = this.fields.pop()! ?? [];
      if ('indent' in node && this.top.indent !== ind) {
        throw this.buildError('Unable to set value, incorrect nesting');
      }
      this.top.consume(node, field);
    } else {
      this.top.consume!(node);
    }
  }

  /**
   * Read a line of tokens
   */
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

  /**
   * Build error message
   */
  buildError(msg: string) {
    const [start, end] = this.lines[this.lineCount - 1];
    const err = new Error(`${msg}, line: ${this.lineCount}\n${this.text.substring(start, end)}`);
    err.stack = err.stack?.split(/\n/g).slice(2).join('\n');
    return err;
  }
}