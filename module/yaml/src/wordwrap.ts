import { Tokenizer } from './tokenizer';

export class WordWrapper {

  static wrap(text: string, width: number) {
    return new WordWrapper(text, width).process();
  }

  lines: string[] = [];
  line: string[] = [];
  subl: number = 0;

  constructor(public text: string, public width: number) { }

  pushLine() {
    while (this.line.length && Tokenizer.isWhitespace(this.line[this.line.length - 1])) {
      this.line.pop();
    }
    if (this.subl > 0) {
      this.lines.push(this.line.join(''));
      this.line = [];
      this.subl = 0;
    }
  }

  pushPart(part: string) {
    if (part === '\n') {
      this.pushLine();
    } else {
      if (this.subl + part.length > this.width) {
        this.pushLine();
        if (Tokenizer.isWhitespace(part)) {
          return;
        }
      }
      this.line.push(part);
      this.subl += part.length;
    }
  }

  process() {
    for (const part of Tokenizer.tokenize(this.text)) {
      this.pushPart(part);
    }

    this.pushLine();
    return this.lines;
  }
}