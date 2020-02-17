import * as ts from 'typescript';

import { SystemUtil } from '@travetto/base';

import * as res from './types/resolver';
import { Import } from './types/shared';
import { TransformUtil } from './util';

export class ImportManager {
  private newImports = new Map<string, Import>();
  private imports: Map<string, Import>;

  constructor(public source: ts.SourceFile) {
    this.imports = TransformUtil.collectImports(source);
  }

  importFile(path: string) {
    if (!path.endsWith('.d.ts') && !this.newImports.has(path)) {
      const id = `i_${SystemUtil.naiveHash(path)}`;

      if (this.imports.has(id)) { // Already imported, be cool
        return this.imports.get(id)!;
      }

      const ident = ts.createIdentifier(id);
      const imprt = { path, ident };
      this.imports.set(ident.escapedText.toString(), imprt);
      this.newImports.set(path, imprt);
    }
    return this.newImports.get(path)!;
  }

  importFromResolved(type: res.Type) {
    if (res.isExternalType(type)) {
      if (type.source && type.source !== this.source.fileName) {
        this.importFile(type.source);
      }
    }

    const nested = res.isExternalType(type) ? type.typeArguments :
      (res.isUnionType(type) ? type.unionTypes :
        (res.isTupleType(type) ? type.tupleTypes : undefined));

    if (nested) {
      for (const sub of nested) {
        this.importFromResolved(sub);
      }
    }
  }

  finalize(ret: ts.SourceFile) {
    return TransformUtil.addImports(ret, ...this.newImports.values());
  }

  getOrImport(type: res.ExternalType) {
    if (type.source === this.source.fileName) {
      return ts.createIdentifier(type.name!);
    } else {
      const { ident } = this.imports.get(type.source) ?? this.importFile(type.source);
      return ts.createPropertyAccess(ident, type.name!);
    }
  }
}