import * as ts from 'typescript';
import * as path from 'path';

import * as res from './types/resolver';
import { Import } from './types/shared';
import { TransformUtil } from './util';

export class ImportManager {
  private newImports = new Map<string, Import>();
  private imports: Map<string, Import>;
  private idx: Record<string, number> = {};
  private ids = new Map<string, string>();

  constructor(public source: ts.SourceFile) {
    this.imports = TransformUtil.collectImports(source);
  }

  getId(file: string) {
    if (!this.ids.has(file)) {
      const key = path.basename(file).replace(/[.][^.]*$/, '').replace(/[^A-Za-z0-9]+/g, '_');
      this.ids.set(file, `_${key}_${this.idx[key] = (this.idx[key] || 0) + 1}`);
    }
    return this.ids.get(file)!;
  }

  importFile(file: string) {
    if (!file.endsWith('.d.ts') && !this.newImports.has(file)) {
      const id = this.getId(file);

      if (this.imports.has(id)) { // Already imported, be cool
        return this.imports.get(id)!;
      }

      const ident = ts.createIdentifier(id);
      const imprt = { path: file, ident };
      this.imports.set(ident.escapedText.toString(), imprt);
      this.newImports.set(file, imprt);
    }
    return this.newImports.get(file)!;
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