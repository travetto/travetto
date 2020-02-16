import * as ts from 'typescript';

import * as res from './types/resolver';
import { State } from './types/visitor';

import { TypeResolver } from './resolver';
import { ImportManager } from './importer';
import { DecoratorManager } from './decorator';

export class TransformerState implements State {
  private resolver: TypeResolver;
  private imports: ImportManager;
  private decorator: DecoratorManager;

  readonly ids = new Map<string, number>();

  constructor(public source: ts.SourceFile, checker: ts.TypeChecker) {
    this.imports = new ImportManager(source);
    this.resolver = new TypeResolver(checker);
    this.decorator = new DecoratorManager(this.imports, this.resolver);
  }

  getOrImport(type: res.ExternalType | ts.Node) {
    if ('getSourceFile' in type) {
      type = this.resolveType(type) as res.ExternalType;
      if (!res.isExternalType(type)) {
        throw new Error('Unable to import non-external type');
      }
    }
    return this.imports.getOrImport(type);
  }

  importFile(file: string) {
    return this.imports.importFile(file);
  }

  generateUniqueId(name: string) {
    const val = (this.ids.get(name) ?? 0) + 1;
    this.ids.set(name, val);
    return ts.createIdentifier(`${name}_${val}`);
  }

  resolveType(node: ts.Type | ts.Node) {
    const resolved = this.resolver.resolveType(node);
    this.imports.importFromResolved(resolved);
    return resolved;
  }

  resolveReturnType(node: ts.MethodDeclaration) {
    return this.resolveType(this.resolver.getReturnType(node));
  }

  readJSDocs(node: ts.Type | ts.Node) {
    return this.resolver.readJSDocs(node);
  }

  readDocsTags(node: ts.Node, name: string) {
    return this.resolver.readDocsTags(node, name);
  }

  importDecorator(pth: string, name: string) {
    return this.decorator.importDecorator(pth, name);
  }

  createDecorator(name: string, ...contents: (ts.Expression | undefined)[]) {
    return this.decorator.createDecorator(name, ...contents);
  }

  getDecoratorList(node: ts.Node) {
    return this.decorator.getDecoratorList(node);
  }

  findDecorator(node: ts.Node, target: string, name: string, file: string) {
    return this.getDecoratorList(node).find(x =>
      x.targets?.includes(target)
      && res.isExternalType(x)
      && x.name === name
      && x.source === file
    )?.dec;
  }

  getDecoratorMeta(node: ts.Decorator) {
    return this.decorator.getDecoratorMeta(node);
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