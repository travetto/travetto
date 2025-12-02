import ts from 'typescript';

import { transformCast, DeclDocumentation } from '../types/shared.ts';
import { CoreUtil } from './core.ts';
import { DeclarationUtil } from './declaration.ts';

/**
 * Utilities for dealing with docs
 */
export class DocUtil {
  /**
   * See if node has js docs
   */
  static hasJSDoc(o: ts.Node): o is (ts.Node & { jsDoc: ts.JSDoc[] }) {
    return 'jsDoc' in o && o.jsDoc !== null && o.jsDoc !== undefined && Array.isArray(o.jsDoc) && o.jsDoc.length > 0;
  }

  /**
   * Read doc comment for node
   */
  static getDocComment(o: ts.JSDoc | ts.JSDocTag, def?: string): string | undefined {
    return (typeof o.comment === 'string' ? o.comment : undefined) ?? def;
  }

  /**
   * Read JS Docs from a `ts.Declaration`
   */
  static describeDocs(node: ts.Declaration | ts.Type): DeclDocumentation {
    let toDescribe = (node && !('getSourceFile' in node)) ?
      DeclarationUtil.getOptionalPrimaryDeclarationNode(node) : node;

    const out: DeclDocumentation = {
      description: undefined,
      return: undefined,
      params: []
    };

    if (toDescribe) {
      const tags = ts.getJSDocTags(toDescribe);
      while (!this.hasJSDoc(toDescribe) && CoreUtil.hasOriginal(toDescribe)) {
        toDescribe = transformCast<ts.Declaration>(toDescribe.original);
      }

      const docs = this.hasJSDoc(toDescribe) ? toDescribe.jsDoc : undefined;

      if (docs) {
        const top = docs.at(-1)!;
        if (ts.isJSDoc(top)) {
          out.description = this.getDocComment(top, out.description);
        }
      }

      if (tags && tags.length) {
        for (const tag of tags) {
          if (ts.isJSDocReturnTag(tag)) {
            out.return = this.getDocComment(tag, out.return);
          } else if (ts.isJSDocParameterTag(tag)) {
            out.params!.push({
              name: tag.name && tag.name.getText(),
              description: this.getDocComment(tag, '')!
            });
          }
        }
      }
    }
    return out;
  }

  /**
   * Read JS Doc tags for a type
   */
  static readDocTag(type: ts.Type | ts.Symbol, name: string): string[] {
    const tags = CoreUtil.getSymbol(type)?.getJsDocTags() ?? [];
    return tags
      .filter(tag => tag.name === name && !!tag.text)
      .map(tag => tag.text!.map(x => x.text).join('')); // Join all text
  }

  /**
   * Has JS Doc tags for a type
   */
  static hasDocTag(type: ts.Type | ts.Symbol, name: string): boolean {
    const tags = CoreUtil.getSymbol(type)?.getJsDocTags() ?? [];
    return tags.some(tag => tag.name === name);
  }


  /**
   * Read augments information
   * @param type
   */
  static readAugments(type: ts.Type | ts.Symbol): string[] {
    return this.readDocTag(type, 'augments').map(x => x.replace(/^.*?([^` ]+).*?$/, (_, b) => b));
  }

  /**
   * Read example information
   * @param type
   */
  static readExample(type: ts.Type | ts.Symbol): string[] {
    return this.readDocTag(type, 'example').map(x => x.replace(/^.*?([^` ]+).*?$/, (_, b) => b));
  }
}