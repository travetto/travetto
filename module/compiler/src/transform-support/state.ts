import * as ts from 'typescript';

import * as res from './types/resolver';
import { State, DecoratorMeta } from './types/visitor';

import { TypeResolver } from './resolver';
import { ImportManager } from './importer';
import { TransformUtil } from './util';

export class TransformerState implements State {
  private resolver: TypeResolver;
  private imports: ImportManager;

  readonly decorators = new Map<string, ts.PropertyAccessExpression>();
  readonly ids = new Map<string, number>();

  constructor(public source: ts.SourceFile, checker: ts.TypeChecker) {
    this.imports = new ImportManager(source);
    this.resolver = new TypeResolver(checker);
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

  typeToIdentifier(node: ts.Type | res.Type) {
    if ('flags' in node) {
      node = this.resolveType(node);
    }
    if (res.isLiteralType(node)) {
      return ts.createIdentifier(node.ctor!.name);
    } else if (res.isExternalType(node)) {
      return this.getOrImport(node);
    } else if (res.isShapeType(node)) {
      return;
    }
  }

  resolveReturnType(node: ts.MethodDeclaration) {
    console.debug('Resolving type', node);
    return this.resolveType(this.resolver.getReturnType(node));
  }

  readJSDocs(type: ts.Type | ts.Node) {
    return TransformUtil.readJSDocs(type);
  }

  readDocsTags(node: ts.Node, name: string) {
    return this.resolver.readDocsTags(node, name);
  }

  importDecorator(pth: string, name: string) {
    if (!this.decorators.has(name)) {
      const ref = this.imports.importFile(pth);
      const ident = ts.createIdentifier(name);
      this.decorators.set(name, ts.createPropertyAccess(ref.ident, ident));
    }
    return this.decorators.get(name);
  }

  createDecorator(pth: string, name: string, ...contents: (ts.Expression | undefined)[]) {
    this.importDecorator(pth, name);
    return TransformUtil.createDecorator(this.decorators.get(name)!, ...contents);
  }

  getDecoratorMeta(dec: ts.Decorator): DecoratorMeta {
    const ident = TransformUtil.getDecoratorIdent(dec);
    const decl = this.resolver.getPrimaryDeclaration(ident);
    return ({
      dec,
      ident,
      file: decl?.getSourceFile().fileName,
      targets: this.resolver.readDocsTags(ident, 'augments').map(x => x.replace(/trv \//, 'trv/')),
      name: ident ?
        ident.escapedText! as string :
        undefined as any as string
    });
  }

  getDecoratorList(node: ts.Node): DecoratorMeta[] {
    return ((node.decorators ?? []) as ts.Decorator[])
      .map(dec => this.getDecoratorMeta(dec))
      .filter(x => !!x.ident);
  }

  findDecorator(node: ts.Node, target: string, name?: string, file?: string) {
    return this.getDecoratorList(node).find(x =>
      x.targets?.includes(target)
      && (name === undefined || x.name === name)
      && (file === undefined || x.file === file)
    )?.dec;
  }

  getDeclarations(node: ts.Node): ts.Declaration[] {
    return this.resolver.getDeclarations(node);
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