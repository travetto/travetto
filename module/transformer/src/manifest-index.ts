import ts from 'typescript';

import { RootIndex, IndexedFile, path } from '@travetto/manifest';
import { DeclarationUtil } from './util/declaration';

/**
 * Specific logic for the transformer
 */
export class TransformerIndex {
  /**
   * Resolve import name for a given type
   */
  static getImportName(type: ts.Type | string, removeExt = false): string {
    const ogSource = typeof type === 'string' ? type : DeclarationUtil.getPrimaryDeclarationNode(type).getSourceFile().fileName;
    let sourceFile = path.toPosix(ogSource);

    if (!sourceFile.endsWith('.js') && !sourceFile.endsWith('.ts')) {
      sourceFile = `${sourceFile}.ts`;
    }

    const imp =
      RootIndex.getEntry(/[.]ts$/.test(sourceFile) ? sourceFile : `${sourceFile}.js`)?.import ??
      RootIndex.getFromImport(sourceFile.replace(/^.*node_modules\//, '').replace(/[.]ts$/, ''))?.import ??
      ogSource;

    return removeExt ? imp.replace(/[.]js$/, '') : imp;
  }

  static isKnown(fileOrImport: string): boolean {
    return RootIndex.getFromSource(fileOrImport) !== undefined ?? RootIndex.getFromImport(fileOrImport) !== undefined;
  }

  static getFromImport(imp: string): IndexedFile | undefined {
    return RootIndex.getFromImport(imp);
  }
}