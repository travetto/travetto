import { DocFileUtil } from './file';

export type ResolvedRef = { title: string, file: string, line: number };
export type ResolvedCode = { text: string, language: string, file?: string };
export type ResolvedSnippet = { text: string, language: string, file: string, line: number };
export type ResolvedSnippetLink = { file: string, line: number };

/**
 * Resolve utilities
 */
export class DocResolveUtil {

  static async resolveRef(title: string, file: string): Promise<ResolvedRef> {

    let line = 0;
    const res = await DocFileUtil.readSource(file);
    file = res.file;

    if (res.content) {
      line = res.content.split(/\n/g)
        .findIndex(x => new RegExp(`(class|function)[ ]+${title}`).test(x));
      if (line < 0) {
        line = 0;
      } else {
        line += 1;
      }
      if (await DocFileUtil.isDecorator(title, file)) {
        title = `@${title}`;
      }
    }
    return { title, file, line };
  }

  static async resolveCode(content: string | Function, language?: string, outline = false): Promise<ResolvedCode> {
    const res = DocFileUtil.readSource(content);
    let text = res.content;

    let file: string | undefined;
    if (res.file) {
      language = res.language;
      file = res.file;
      if (outline) {
        text = DocFileUtil.buildOutline(text);
      }
    }
    return { text, language: language!, file };
  }

  static async resolveSnippet(file: Function | string, startPattern: RegExp, endPattern?: RegExp, outline = false): Promise<ResolvedSnippet> {
    const { lines, startIdx, language, file: resolvedFile } = await DocFileUtil.readCodeSnippet(file, startPattern);

    const endIdx = endPattern ? lines.findIndex((l, i) => i > startIdx && endPattern.test(l)) : lines.length;
    let text = lines.slice(startIdx, endIdx + 1).join('\n');

    if (outline) {
      text = DocFileUtil.buildOutline(text);
    }

    return { text, language, line: startIdx + 1, file: resolvedFile };
  }

  static async resolveCodeLink(file: Function | string, startPattern: RegExp): Promise<ResolvedSnippetLink> {
    const { startIdx, file: resolvedFile } = await DocFileUtil.readCodeSnippet(file, startPattern);
    return { file: resolvedFile, line: startIdx + 1 };
  }
}