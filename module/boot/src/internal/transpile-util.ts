import { readFileSync } from 'fs';

import { Host } from '../host';

type SourceHandler = (text: string) => string;

const CONSOLE_RE = /(\bconsole[.](debug|info|warn|log|error)[(])|\n/g;

const SOURCE_HANDLERS: SourceHandler[] = [
  // Tag source as processed by framework
  (text): string => `${text}\nObject.defineProperty(exports, 'ᚕtrv', { configurable: true, value: true });`,
  // Suppress typescript imports, and use a global proxy for performance
  (text): string => text.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript';/mg, x => `// ${x}`),
  // Modify console.log statements to include file and line
  (text): string => {
    let line = 1;
    text = text.replace(CONSOLE_RE, (a, cmd, lvl) => {
      if (a === '\n') {
        line += 1;
        return a;
      } else {
        lvl = lvl === 'log' ? 'info' : lvl;
        return `ᚕlog('${lvl}', { file: __filename, line: ${line} },`;
      }
    });
    return text;
  }
];

/**
 * Standard transpilation support
 */
export class TranspileUtil {

  /**
   * Pre-processes a typescript source file
   * @param filename The file to preprocess
   * @param contents The file contents to process
   */
  static preProcess(filename: string, contents?: string): string {
    let fileContents = contents ?? readFileSync(filename, 'utf-8');

    for (const handler of SOURCE_HANDLERS) {
      fileContents = handler(fileContents);
    }

    return fileContents;
  }
}