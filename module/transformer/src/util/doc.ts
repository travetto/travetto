import * as ts from 'typescript';

import { DeclDocumentation } from '../types/shared';
import { CoreUtil } from './core';
import { DeclarationUtil } from './declaration';

/**
 * Utilities for dealing with docs
 */
export class DocUtil {
  /**
   * See if node has js docs
   */
  static hasJSDoc(o: ts.Node): o is (ts.Node & { jsDoc: ts.JSDoc[] }) {
    return 'jsDoc' in o;
  }

  /**
   * Read JS Docs from a `ts.Declaration`
   */
  static describeDocs(node: ts.Declaration | ts.Type) {
    if (!('getSourceFile' in node)) {
      node = DeclarationUtil.getPrimaryDeclarationNode(node);
    }
    const out: DeclDocumentation = {
      description: undefined,
      return: undefined,
      params: []
    };

    if (node) {
      const tags = ts.getJSDocTags(node);
      while (!this.hasJSDoc(node) && CoreUtil.hasOriginal(node)) {
        node = node.original as ts.Declaration;
      }

      const docs = this.hasJSDoc(node) ? node.jsDoc : undefined;

      if (docs) {
        const top = docs[docs.length - 1];
        if (ts.isJSDoc(top)) {
          out.description = top.comment;
        }
      }

      if (tags && tags.length) {
        for (const tag of tags) {
          if (ts.isJSDocReturnTag(tag)) {
            out.return = tag.comment;
          } else if (ts.isJSDocParameterTag(tag)) {
            out.params!.push({
              name: tag.name && tag.name.getText(),
              description: tag.comment ?? ''
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
      .filter(el => el.name === name)
      .map(el => el.text!);
  }

  /**
   * Read augments information
   * @param type
   */
  static readAugments(type: ts.Type | ts.Symbol) {
    return this.readDocTag(type, 'augments').map(x => x.replace(/^.*?([^` ]+).*?$/, (_, b) => b));
  }
}