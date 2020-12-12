import * as ts from 'typescript';

import { ExternalType, AnyType } from './resolver/types';
import { State, DecoratorMeta, Transformer, TransformerId } from './types/visitor';


import { TypeResolver } from './resolver/service';
import { ImportManager } from './importer';
import { DocUtil } from './util/doc';
import { DecoratorUtil } from './util/decorator';
import { DeclarationUtil } from './util/declaration';
import { CoreUtil, LiteralUtil } from './util';

/**
 * Transformer runtime state
 */
export class TransformerState implements State {
  private resolver: TypeResolver;
  private imports: ImportManager;
  private decorators = new Map<string, ts.PropertyAccessExpression>();
  added = new Map<number, ts.Statement[]>();

  constructor(public source: ts.SourceFile, public factory: ts.NodeFactory, checker: ts.TypeChecker) {
    this.imports = new ImportManager(source, factory);
    this.resolver = new TypeResolver(checker);
  }

  /**
   * Get or import the node or external type
   */
  getOrImport(type: ExternalType) {
    return this.imports.getOrImport(this.factory, type);
  }

  /**
   * Import a given file
   */
  importFile(file: string) {
    return this.imports.importFile(file);
  }

  /**
   * Resolve an `AnyType` from a `ts.Type` or `ts.Node`
   */
  resolveType(node: ts.Type | ts.Node) {
    const resolved = this.resolver.resolveType(node);
    this.imports.importFromResolved(resolved);
    return resolved;
  }

  /**
   * Resolve external type
   */
  resolveExternalType(node: ts.Node) {
    const resolved = this.resolveType(node);
    if (resolved.key !== 'external') {
      throw new Error(`Unable to import non-external type: ${node.getText()} ${resolved.key}: ${node.getSourceFile().fileName}`);
    }
    return resolved;
  }

  /**
   * Convert a type to it's identifier, will return undefined if none match
   */
  typeToIdentifier(node: ts.Type | AnyType) {
    const type = 'flags' in node ? this.resolveType(node) : node;
    switch (type.key) {
      case 'literal': return this.factory.createIdentifier(type.ctor!.name);
      case 'external': return this.getOrImport(type);
      case 'shape': return;
    }
  }

  /**
   * Resolve the return type
   */
  resolveReturnType(node: ts.MethodDeclaration) {
    return this.resolveType(this.resolver.getReturnType(node));
  }

  /**
   * Read all JSDoc tags
   */
  readDocTag(node: ts.Declaration, name: string) {
    return DocUtil.readDocTag(this.resolver.getType(node), name);
  }

  /**
   * Import a decorator, generally to handle erasure
   */
  importDecorator(pth: string, name: string) {
    if (!this.decorators.has(`${pth}:${name}`)) {
      const ref = this.imports.importFile(pth);
      const ident = this.factory.createIdentifier(name);
      this.decorators.set(name, this.factory.createPropertyAccessExpression(ref.ident, ident));
    }
    return this.decorators.get(name);
  }

  /**
   * Create a decorator to add functionality to a declaration
   */
  createDecorator(pth: string, name: string, ...contents: (ts.Expression | undefined)[]) {
    this.importDecorator(pth, name);
    return CoreUtil.createDecorator(this.factory, this.decorators.get(name)!, ...contents);
  }

  /**
   * Read a decorator's metadata
   */
  getDecoratorMeta(dec: ts.Decorator): DecoratorMeta {
    const ident = DecoratorUtil.getDecoratorIdent(dec);
    const decl = DeclarationUtil.getPrimaryDeclarationNode(
      this.resolver.getType(ident)
    );

    return ({
      dec,
      ident,
      file: decl?.getSourceFile().fileName,
      targets: DocUtil.readAugments(this.resolver.getType(ident)),
      name: ident ?
        ident.escapedText! as string :
        undefined
    });
  }

  /**
   * Get list of all decorators for a node
   */
  getDecoratorList(node: ts.Node): DecoratorMeta[] {
    return ((node.decorators ?? []) as ts.Decorator[])
      .map(dec => this.getDecoratorMeta(dec))
      .filter(x => !!x.ident);
  }

  /**
   * Get all declarations for a node
   */
  getDeclarations(node: ts.Node): ts.Declaration[] {
    return DeclarationUtil.getDeclarations(this.resolver.getType(node));
  }

  /**
   * Register statement for inclusion in final output
   * @param stmt
   * @param before
   */
  addStatement(stmt: ts.Statement, before?: ts.Node) {
    const stmts = this.source.statements.slice(0);
    let idx = stmts.length;
    let n = before;
    if (n && !n.parent && (n as any).original) {
      n = (n as any).original;
    }
    while (n && !ts.isSourceFile(n.parent)) {
      n = n.parent;
    }
    if (n && ts.isSourceFile(n.parent) && stmts.indexOf(n as ts.Statement) >= 0) {
      idx = stmts.indexOf(n as ts.Statement) - 1;
    }
    if (!this.added.has(idx)) {
      this.added.set(idx, []);
    }
    this.added.get(idx)!.push(stmt);
  }

  /**
   * Finalize the source file for emission
   */
  finalize(ret: ts.SourceFile) {
    ret = this.imports.finalize(ret);
    return ret;
  }

  /**
   * Get Filename as ᚕsrc
   */
  getFilenameAsSrc() {
    const ident = this.factory.createIdentifier('ᚕsrc');
    ident.getSourceFile = () => this.source;
    return this.factory.createCallExpression(ident, [], [this.createIdentifier('__filename')]);
  }

  /**
   * From literal
   */
  fromLiteral<T extends ts.Expression>(val: T): T;
  fromLiteral(val: undefined): ts.Identifier;
  fromLiteral(val: null): ts.NullLiteral;
  fromLiteral(val: object): ts.ObjectLiteralExpression;
  fromLiteral(val: any[]): ts.ArrayLiteralExpression;
  fromLiteral(val: string | boolean | number): ts.LiteralExpression;
  fromLiteral(val: any) {
    return LiteralUtil.fromLiteral(this.factory, val);
  }

  /**
   * Extend
   */
  extendObjectLiteral(src: object | ts.Expression, ...rest: (object | ts.Expression)[]) {
    return LiteralUtil.extendObjectLiteral(this.factory, src, ...rest);
  }

  /**
   * Create property access
   */
  createAccess(first: string | ts.Expression, second: string | ts.Identifier, ...items: (string | ts.Identifier)[]) {
    return CoreUtil.createAccess(this.factory, first, second, ...items);
  }

  /**
   * Create a static field for a class
   */
  createStaticField(name: string, val: ts.Expression): ts.PropertyDeclaration {
    return CoreUtil.createStaticField(this.factory, name, val);
  }

  createIdentifier(name: string | { getText(): string }) {
    return this.factory.createIdentifier(typeof name === 'string' ? name : name.getText());
  }


  /**
   * Find decorator, relative to registered key
   * @param state
   * @param node
   * @param name
   * @param file
   */
  findDecorator(cls: Transformer, node: ts.Node, name: string, file?: string) {
    const target = `${cls[TransformerId]}/${name}`;
    return this.getDecoratorList(node)
      .find(x => x.targets?.includes(target) && (file ? x.name === name && x.file === file : true))?.dec;
  }
}