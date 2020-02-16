import * as ts from 'typescript';

import * as trv from './types';
import { TypeChecker } from './checker';
import { ImportManager } from './imports';
import { DecoratorManager } from './decorator';

export class TransformerState {
  private checker: TypeChecker;
  private imports: ImportManager;
  private decorator: DecoratorManager;

  readonly ids = new Map<string, number>();

  constructor(public source: ts.SourceFile, checker: ts.TypeChecker) {
    this.imports = new ImportManager(source);
    this.checker = new TypeChecker(checker);
    this.decorator = new DecoratorManager(this.imports);
  }

  getImport(type: trv.ExternalType) {
    return this.imports.getOrImport(type);
  }

  generateUniqueId(name: string) {
    const val = (this.ids.get(name) ?? 0) + 1;
    this.ids.set(name, val);
    return ts.createIdentifier(`${name}_${val}`);
  }

  resolveType(node: ts.Type | ts.Node) {
    const resolved = this.checker.resolveType(node);
    this.imports.importFromResolved(resolved);
    return resolved;
  }

  resolveReturnType(node: ts.MethodDeclaration) {
    return this.resolveType(this.checker.getReturnType(node));
  }

  readJSDocs(node: ts.Type | ts.Node) {
    return this.checker.readJSDocs(node);
  }

  importDecorator(pth: string, name: string) {
    return this.decorator.importDecorator(pth, name);
  }

  createDecorator(name: string, ...contents: (ts.Expression | undefined)[]) {
    return this.decorator.createDecorator(name, ...contents);
  }

  finalize(ret: ts.SourceFile) {
    ret = this.imports.finalize(ret);

    for (const el of ret.statements) {
      if (!el.parent) {
        el.parent = ret;
      }
    }
    return ret;
  }
}