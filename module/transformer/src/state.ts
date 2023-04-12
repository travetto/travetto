import ts from 'typescript';

import { ManifestIndex, path } from '@travetto/manifest';

import { ManagedType, AnyType, ForeignType } from './resolver/types';
import { State, DecoratorMeta, Transformer, ModuleNameⲐ } from './types/visitor';
import { SimpleResolver } from './resolver/service';
import { ImportManager } from './importer';
import { Import } from './types/shared';

import { DocUtil } from './util/doc';
import { DecoratorUtil } from './util/decorator';
import { DeclarationUtil } from './util/declaration';
import { CoreUtil } from './util/core';
import { LiteralUtil } from './util/literal';
import { SystemUtil } from './util/system';

function hasOriginal(n: unknown): n is { original: ts.Node } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !!n && !(n as { parent?: unknown }).parent && !!(n as { original: unknown }).original;
}

function hasEscapedName(n: unknown): n is { name: { escapedText: string } } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !!n && !!(n as { name?: { escapedText?: string } }).name?.escapedText;
}

/**
 * Transformer runtime state
 */
export class TransformerState implements State {
  static SYNTHETIC_EXT = 'Ⲑsyn';

  #resolver: SimpleResolver;
  #imports: ImportManager;
  #fileIdent: ts.Identifier;
  #manifestIndex: ManifestIndex;
  #syntheticIdentifiers = new Map<string, ts.Identifier>();
  #decorators = new Map<string, ts.PropertyAccessExpression>();
  added = new Map<number, ts.Statement[]>();
  importName: string;
  file: string;

  constructor(public source: ts.SourceFile, public factory: ts.NodeFactory, checker: ts.TypeChecker, manifestIndex: ManifestIndex) {
    this.#manifestIndex = manifestIndex;
    this.#resolver = new SimpleResolver(checker, manifestIndex);
    this.#imports = new ImportManager(source, factory, this.#resolver);
    this.file = path.toPosix(this.source.fileName);

    this.importName = this.#resolver.getFileImportName(this.file, true);
  }

  /**
   * Get or import the node or external type
   */
  getOrImport(type: ManagedType): ts.Identifier | ts.PropertyAccessExpression {
    return this.#imports.getOrImport(this.factory, type);
  }

  /**
   * Import a given file
   */
  importFile(file: string, name?: string): Import {
    return this.#imports.importFile(file, name);
  }

  /**
   * Resolve an `AnyType` from a `ts.Type` or `ts.Node`
   */
  resolveType(node: ts.Type | ts.Node): AnyType {
    const resolved = this.#resolver.resolveType(node, this.importName);
    this.#imports.importFromResolved(resolved);
    return resolved;
  }

  /**
   * Resolve external type
   */
  resolveManagedType(node: ts.Node): ManagedType {
    const resolved = this.resolveType(node);
    if (resolved.key !== 'managed') {
      const file = node.getSourceFile().fileName;
      const src = this.#resolver.getFileImportName(file);
      throw new Error(`Unable to import non-external type: ${node.getText()} ${resolved.key}: ${src}`);
    }
    return resolved;
  }

  /**
   * Convert a type to it's identifier, will return undefined if none match
   */
  typeToIdentifier(node: ts.Type | AnyType): ts.Identifier | ts.PropertyAccessExpression | undefined {
    const type = 'flags' in node ? this.resolveType(node) : node;
    switch (type.key) {
      case 'literal': return this.factory.createIdentifier(type.ctor!.name);
      case 'managed': return this.getOrImport(type);
      case 'shape': return;
    }
  }

  /**
   * Resolve the return type
   */
  resolveReturnType(node: ts.MethodDeclaration): AnyType {
    const typeNode = ts.getJSDocReturnType(node);
    if (typeNode) {
      const resolved = this.#resolver.getChecker().getTypeFromTypeNode(typeNode);
      return this.resolveType(resolved);
    } else {
      return this.resolveType(this.#resolver.getReturnType(node));
    }
  }

  /**
   * Read all JSDoc tags
   */
  readDocTag(node: ts.Declaration, name: string): string[] {
    return DocUtil.readDocTag(this.#resolver.getType(node), name);
  }

  /**
   * Import a decorator, generally to handle erasure
   */
  importDecorator(pth: string, name: string): ts.PropertyAccessExpression | undefined {
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
  createDecorator(pth: string, name: string, ...contents: (ts.Expression | undefined)[]): ts.Decorator {
    this.importDecorator(pth, name);
    return CoreUtil.createDecorator(this.factory, this.#decorators.get(name)!, ...contents);
  }

  /**
   * Read a decorator's metadata
   */
  getDecoratorMeta(dec: ts.Decorator): DecoratorMeta | undefined {
    const ident = DecoratorUtil.getDecoratorIdent(dec);
    const decl = DeclarationUtil.getPrimaryDeclarationNode(
      this.#resolver.getType(ident)
    );
    const src = decl?.getSourceFile().fileName;
    const mod = src ? this.#resolver.getFileImportName(src, true) : undefined;
    const file = this.#manifestIndex.getFromImport(mod ?? '')?.outputFile;
    const targets = DocUtil.readAugments(this.#resolver.getType(ident));
    const module = file ? mod : undefined;
    const name = ident ?
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ident.escapedText! as string :
      undefined;

    if (ident && name) {
      return { dec, ident, file, module, targets, name };
    }
  }

  /**
   * Get list of all #decorators for a node
   */
  getDecoratorList(node: ts.Node): DecoratorMeta[] {
    return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? [])
      .map(dec => this.getDecoratorMeta(dec))
      .filter((x): x is DecoratorMeta => !!x) : [];
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
  addStatements(added: ts.Statement[], before?: ts.Node | number): void {
    const stmts = this.source.statements.slice(0);
    let idx = stmts.length + 1000;

    if (before && typeof before !== 'number') {
      let n = before;
      if (hasOriginal(n)) {
        n = n.original;
      }
      while (n && !ts.isSourceFile(n.parent) && n !== n.parent) {
        n = n.parent;
      }
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const nStmt: ts.Statement = n as ts.Statement;
      if (n && ts.isSourceFile(n.parent) && stmts.indexOf(nStmt) >= 0) {
        idx = stmts.indexOf(nStmt) - 1;
      }
    } else if (before !== undefined) {
      idx = before;
    }
    if (!this.added.has(idx)) {
      this.added.set(idx, []);
    }
    this.added.get(idx)!.push(...added);
  }

  /**
   * Finalize the source file for emission
   */
  finalize(ret: ts.SourceFile): ts.SourceFile {
    ret = this.#imports.finalize(ret);
    return ret;
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return LiteralUtil.fromLiteral(this.factory, val as object);
  }

  /**
   * Extend
   */
  extendObjectLiteral(src: object | ts.Expression, ...rest: (object | ts.Expression)[]): ts.ObjectLiteralExpression {
    return LiteralUtil.extendObjectLiteral(this.factory, src, ...rest);
  }

  /**
   * Create property access
   */
  createAccess(first: string | ts.Expression, second: string | ts.Identifier, ...items: (string | number | ts.Identifier)[]): ts.Expression {
    return CoreUtil.createAccess(this.factory, first, second, ...items);
  }

  /**
   * Create a static field for a class
   */
  createStaticField(name: string, val: ts.Expression): ts.PropertyDeclaration {
    return CoreUtil.createStaticField(this.factory, name, val);
  }

  /**
   * Create identifier from node or text
   * @param name
   */
  createIdentifier(name: string | { getText(): string }): ts.Identifier {
    return this.factory.createIdentifier(typeof name === 'string' ? name : name.getText());
  }

  /**
   * Get filename identifier, regardless of module system
   */
  getFilenameIdentifier(): ts.Expression {
    if (this.#fileIdent === undefined) {
      this.#fileIdent = this.createIdentifier('ᚕf');
      const decl = this.factory.createVariableDeclaration(this.#fileIdent, undefined, undefined,
        this.fromLiteral(this.#resolver.getFileImportName(this.source.fileName) ?? this.source.fileName)
      );
      this.addStatements([
        this.factory.createVariableStatement([], this.factory.createVariableDeclarationList([decl]))
      ], -1);
    }
    return this.#fileIdent;
  }

  /**
   * Find decorator, relative to registered key
   * @param state
   * @param node
   * @param name
   * @param module
   */
  findDecorator(mod: string | Transformer, node: ts.Node, name: string, module?: string): ts.Decorator | undefined {
    mod = typeof mod === 'string' ? mod : mod[ModuleNameⲐ]!;
    const target = `${mod}:${name}`;
    const list = this.getDecoratorList(node);
    return list.find(x => x.targets?.includes(target) && (!module || x.name === name && x.module === module))?.dec;
  }

  /**
   * Generate unique identifier for node
   * @param node
   * @param type
   */
  generateUniqueIdentifier(node: ts.Node, type: AnyType): string {
    let unique: string | undefined;
    try {
      // Tie to source location if possible
      const tgt = DeclarationUtil.getPrimaryDeclarationNode(type.original!);
      const fileName = tgt.getSourceFile().fileName;

      if (fileName === this.source.fileName) { // if in same file suffix with location
        unique = `${ts.getLineAndCharacterOfPosition(tgt.getSourceFile(), tgt.getStart()).line}_${tgt.getEnd() - tgt.getStart()}`;
      } else {
        // Otherwise treat it as external and add nothing to it
      }
    } catch {
      // Determine type unique ident
      const imp = this.#resolver.getFileImportName(this.source.fileName);
      unique = `${SystemUtil.naiveHash(`${imp}${type.name ?? 'unknown'}`)}`;
    }
    // Otherwise read name with uuid
    let name = type.name && !type.name.startsWith('_') ? type.name : '';
    if (!name && hasEscapedName(node)) {
      name = `${node.name.escapedText}`;
    }
    name ||= 'Shape';
    return unique ? `${name}_${unique}` : name;
  }

  /**
   * Register synthetic identifier
   */
  createSyntheticIdentifier(id: string): [identifier: ts.Identifier, exists: boolean] {
    id = `${id}${TransformerState.SYNTHETIC_EXT}`;
    let exists = true;
    if (!this.#syntheticIdentifiers.has(id)) {
      this.#syntheticIdentifiers.set(id, this.factory.createIdentifier(id));
      exists = false;
    }
    return [this.#syntheticIdentifiers.get(id)!, exists];
  }

  /**
   * Find a method declaration, by name
   * @param cls
   * @param method
   */
  findMethodByName(cls: ts.ClassLikeDeclaration | ts.Type, method: string): ts.MethodDeclaration | undefined {
    if ('getSourceFile' in cls) {
      return cls.members.find(
        (m): m is ts.MethodDeclaration => ts.isMethodDeclaration(m) && ts.isIdentifier(m.name) && m.name.escapedText === method
      );
    } else {
      const props = this.#resolver.getPropertiesOfType(cls);
      for (const prop of props) {
        const decl = prop.declarations?.[0];
        if (decl && prop.escapedName === method && ts.isMethodDeclaration(decl)) {
          return decl;
        }
      }
    }
  }

  /**
   * Get import name for a given file
   * @param file
   */
  getFileImportName(file: string): string {
    return this.#resolver.getFileImportName(file);
  }

  /**
   * Get foreign target
   */
  getForeignTarget(state: TransformerState, ret: ForeignType): ts.Expression {
    return state.fromLiteral({
      Ⲑid: `${ret.source.split('node_modules/')[1]}+${ret.name}`
    });
  }
}