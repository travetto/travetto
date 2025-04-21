import { DocFileUtil } from './file.ts';
import { CodeProps } from './types.ts';

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
    const result = await DocFileUtil.readSource(file);
    file = result.file;

    if (result.content) {
      line = result.content.split(/\n/g)
        .findIndex(x => new RegExp(`(class|interface|function)[ ]+${title.replaceAll('$', '\\$')}`).test(x));
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
    const result = DocFileUtil.readSource(content);
    let text = result.content;

    let file: string | undefined;
    if (result.file) {
      language = result.language;
      file = result.file;
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

  static applyCodePropDefaults(props: CodeProps) {
    const type = typeof props.src === 'function' ? props.src : undefined;
    props.startRe ??= props.startRe ?? (type ? new RegExp(`^(export)?\\s*(interface|class)\\s+${type.name.replaceAll('$', '\\$')}\\b`) : undefined);
    props.language ??= (type ? 'typescript' : undefined);
    props.endRe ??= (type ? /^[}]/ : undefined);
    props.title ??= typeof props.src == 'function' ? props.src.name.replace(/^[$]/, '') : undefined;
  }
}