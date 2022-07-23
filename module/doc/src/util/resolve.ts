import { FsUtil } from '@travetto/boot';
import { FileUtil } from './file';

/**
 * Resolve utilities
 */
export class ResolveUtil {

  static resolveRef<T>(title: string | T, file: string): { title: string | T, file: string, line: number } {

    let line = 0;
    const { resolved } = FileUtil.resolveFile(file);
    file = resolved;

    if (!FsUtil.existsSync(file)) {
      throw new Error(`${file} is not a valid location`);
    } else {
      const res = FileUtil.read(file);
      file = res.file;
      if (typeof title == 'string') {
        if (res.content) {
          line = res.content.split(/\n/g)
            .findIndex(x => new RegExp(`(class|function)[ ]+${title}`).test(x));
          if (line < 0) {
            line = 0;
          } else {
            line += 1;
          }
          if (FileUtil.isDecorator(title, file)) {
            title = `@${title}`;
          }
        }
      }
    }
    return { title, file, line };
  }

  static resolveCode<T>(content: string | T, language: string, outline = false): { content: string | T, language: string, file?: string } {
    let file: string | undefined;
    if (typeof content === 'string') {
      if (/^[@:A-Za-z0-9\/\\\-_.]+[.]([a-z]{2,4})$/.test(content)) {
        const res = FileUtil.read(content);
        language = res.language;
        file = res.file;
        content = res.content;
        if (outline) {
          content = FileUtil.buildOutline(content);
        }
      }
      content = content.replace(/^\/\/# sourceMap.*$/gm, '');
    }
    return { content, language, file };
  }

  static resolveConfig<T>(content: string | T, language: string): { content: string | T, language: string, file?: string } {
    let file: string | undefined;
    if (typeof content === 'string') {
      if (/^[@:A-Za-z0-9\/\\\-_.]+[.](ya?ml|properties)$/.test(content)) {
        const res = FileUtil.read(content);
        language = res.language;
        file = res.file;
        content = res.content;
      }
    }
    return { content, language, file };
  }

  static resolveSnippet(file: string, startPattern: RegExp, endPattern?: RegExp, outline = false): { text: string, language: string, file: string, line: number } {
    const res = FileUtil.read(file);
    const language = res.language;
    file = res.file;
    const content = res.content.split(/\n/g);
    const startIdx = content.findIndex(l => startPattern.test(l));

    if (startIdx < 0) {
      throw new Error(`Pattern ${startPattern.source} not found in ${file}`);
    }

    const endIdx = endPattern ? content.findIndex((l, i) => i > startIdx && endPattern.test(l)) : content.length;
    let text = content.slice(startIdx, endIdx + 1).join('\n');

    if (outline) {
      text = FileUtil.buildOutline(text);
    }
    return { text, language, line: startIdx + 1, file };
  }

  static resolveSnippetLink(file: string, startPattern: RegExp): { file: string, line: number } {
    const res = FileUtil.read(file);
    const line = res.content.split(/\n/g).findIndex(l => startPattern.test(l));
    if (line < 0) {
      throw new Error(`Pattern ${startPattern.source} not found in ${file}`);
    }
    return { file: res.file, line: line + 1 };
  }
}