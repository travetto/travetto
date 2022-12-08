import ts from 'typescript';

import { ManifestIndex, path } from '@travetto/manifest';
import { DeclarationUtil } from './util/declaration';


/**
 * Specific logic for the transformer
 */
export class TransformerIndex extends ManifestIndex {

  /**
   */
  getImportName(type: ts.Type | string, removeExt = false): string {
    const ogSource = typeof type === 'string' ? type : DeclarationUtil.getPrimaryDeclarationNode(type).getSourceFile().fileName;
    let sourceFile = path.toPosix(ogSource);

    if (!sourceFile.endsWith('.js') && !sourceFile.endsWith('.ts')) {
      sourceFile = `${sourceFile}.ts`;
    }

    const imp =
      this.getEntry(/[.]ts$/.test(sourceFile) ? sourceFile : `${sourceFile}.js`)?.import ??
      this.getFromImport(sourceFile.replace(/^.*node_modules\//, '').replace(/[.]ts$/, ''))?.import ??
      ogSource;

    return removeExt ? imp.replace(/[.]js$/, '') : imp;
  }
}