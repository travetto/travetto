import * as ts from 'typescript';

import { SystemUtil } from '@travetto/boot/src/internal/system';
import { ModuleUtil } from '@travetto/boot/src/internal/module-util';
import { Util } from '@travetto/base';

import { ExternalType, AnyType } from './resolver/types';
import { State, DecoratorMeta, Transformer, TransformerId } from './types/visitor';

import { TypeResolver } from './resolver/service';
import { ImportManager } from './importer';
import { DocUtil } from './util/doc';
import { DecoratorUtil } from './util/decorator';
import { DeclarationUtil } from './util/declaration';
import { CoreUtil, LiteralUtil } from './util';

function hasOriginal(n: unknown): n is { original: ts.Node } {
  return !!n && !(n as { parent?: unknown }).parent && !!(n as { original: unknown }).original;
}

function hasEscapedName(n: unknown): n is { name: { escapedText: string } } {
  return !!n && !!(n as { name?: { escapedText?: string } }).name?.escapedText;
}

/**
 * Transformer runtime state
 */
export class TransformerState implements State {
  static SYNTHETIC_EXT = 'ᚕsyn';

  #resolver: TypeResolver;
  #imports: ImportManager;
  #syntheticIdentifiers = new Map<string, ts.Identifier>();
  #decorators = new Map<string, ts.PropertyAccessExpression>();

  added = new Map<number, ts.Statement[]>();
  module: string;

  constructor(public source: ts.SourceFile, public factory: ts.NodeFactory, checker: ts.TypeChecker) {
    this.#imports = new ImportManager(source, factory);
    this.#resolver = new TypeResolver(checker);
    this.module = ModuleUtil.normalizePath(this.source.fileName);
  }

  /**
   * Allow access to resolver
   * @private
   */
  getResolver() {
    return this.#resolver;
  }

  /**
   * Get or import the node or external type
   */
  getOrImport(type: ExternalType) {
    return this.#imports.getOrImport(this.factory, type);
  }

  /**
   * Import a given file
   */
  importFile(file: string) {
    return this.#imports.importFile(file);
  }

  /**
   * Resolve an `AnyType` from a `ts.Type` or `ts.Node`
   */
  resolveType(node: ts.Type | ts.Node) {
    const resolved = this.#resolver.resolveType(node);
    this.#imports.importFromResolved(resolved);
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
    return this.resolveType(this.#resolver.getReturnType(node));
  }

  /**
   * Read all JSDoc tags
   */
  readDocTag(node: ts.Declaration, name: string) {
    return DocUtil.readDocTag(this.#resolver.getType(node), name);
  }

  /**
   * Import a decorator, generally to handle erasure
   */
  importDecorator(pth: string, name: string) {
    if (!this.#decorators.has(`${pth}:${name}`)) {
      const ref = this.#imports.importFile(pth);
      const ident = this.factory.createIdentifier(name);
      this.#decorators.set(name, this.factory.createPropertyAccessExpression(ref.ident, ident));
    }
    return this.#decorators.get(name);
  }

  /**
   * Create a decorator to add functionality to a declaration
   */
  createDecorator(pth: string, name: string, ...contents: (ts.Expression | undefined)[]) {
    this.importDecorator(pth, name);
    return CoreUtil.createDecorator(this.factory, this.#decorators.get(name)!, ...contents);
  }

  /**
   * Read a decorator's metadata
   */
  getDecoratorMeta(dec: ts.Decorator): DecoratorMeta {
    const ident = DecoratorUtil.getDecoratorIdent(dec);
    const decl = DeclarationUtil.getPrimaryDeclarationNode(
      this.#resolver.getType(ident)
    );

    return {
      dec,
      ident,
      file: decl?.getSourceFile().fileName,
      module: decl ? ModuleUtil.normalizePath(decl.getSourceFile().fileName) : undefined, // All #decorators will be absolute
      targets: DocUtil.readAugments(this.#resolver.getType(ident)),
      name: ident ?
        ident.escapedText! as string :
        undefined
    };
  }

  /**
   * Get list of all #decorators for a node
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
    return DeclarationUtil.getDeclarations(this.#resolver.getType(node));
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
    if (hasOriginal(n)) {
      n = n.original;
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
    ret = this.#imports.finalize(ret);
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
  fromLiteral(val: unknown[]): ts.ArrayLiteralExpression;
  fromLiteral(val: string | boolean | number): ts.LiteralExpression;
  fromLiteral(val: unknown): ts.Node {
    return LiteralUtil.fromLiteral(this.factory, val as object);
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

  /**
   * Ceate identifier from node or text
   * @param name
   */
  createIdentifier(name: string | { getText(): string }) {
    return this.factory.createIdentifier(typeof name === 'string' ? name : name.getText());
  }

  /**
   * Find decorator, relative to registered key
   * @param state
   * @param node
   * @param name
   * @param module
   */
  findDecorator(cls: Transformer, node: ts.Node, name: string, module?: string) {
    const target = `${cls[TransformerId]}/${name}`;
    return this.getDecoratorList(node)
      .find(x => x.targets?.includes(target) && (!module || x.name === name && x.module === module))?.dec;
  }

  /**
   * Generate unique identifier for node
   * @param node
   * @param type
   */
  generateUniqueIdentifier(node: ts.Node, type: AnyType) {
    let unique: string;
    try {
      // Tie to source location if possible
      const tgt = DeclarationUtil.getPrimaryDeclarationNode(type.original!);
      unique = `${ts.getLineAndCharacterOfPosition(tgt.getSourceFile(), tgt.getStart()).line}_${tgt.getEnd() - tgt.getStart()}`;
      if (tgt.getSourceFile().fileName !== this.source.fileName) { // if in same file
        unique = `${SystemUtil.naiveHash(tgt.getSourceFile().fileName)}_${unique}`;
      }
    } catch {
      // Determine type unique ident
      unique = Util.uuid(type.name ? 5 : 10);
    }
    // Otherwise read name with uuid
    let name = type.name && !type.name.startsWith('_') ? type.name : '';
    if (!name && hasEscapedName(node)) {
      name = `${node.name.escapedText}`;
    }
    return `${name}_${unique}`;
  }

  /**
   * Register synthetic idetnifier
   */
  createSyntheticIdentifier(id: string) {
    id = `${id}${TransformerState.SYNTHETIC_EXT}`;
    let exists = true;
    if (!this.#syntheticIdentifiers.has(id)) {
      this.#syntheticIdentifiers.set(id, this.factory.createIdentifier(id));
      exists = false;
    }
    return [this.#syntheticIdentifiers.get(id), exists] as [id: ts.Identifier, exists: boolean];
  }
}