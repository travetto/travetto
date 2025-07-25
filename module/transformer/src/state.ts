import ts from 'typescript';

import { path, ManifestIndex } from '@travetto/manifest';

import { ManagedType, AnyType, ForeignType } from './resolver/types.ts';
import { State, DecoratorMeta, Transformer, ModuleNameSymbol } from './types/visitor.ts';
import { SimpleResolver } from './resolver/service.ts';
import { ImportManager } from './importer.ts';
import { Import } from './types/shared.ts';

import { DocUtil } from './util/doc.ts';
import { DecoratorUtil } from './util/decorator.ts';
import { DeclarationUtil } from './util/declaration.ts';
import { CoreUtil } from './util/core.ts';
import { LiteralUtil } from './util/literal.ts';
import { SystemUtil } from './util/system.ts';

function hasOriginal(n: ts.Node): n is ts.Node & { original: ts.Node } {
  return !!n && !n.parent && 'original' in n && !!n.original;
}

function hasEscapedName(n: ts.Node): n is ts.Node & { name: { escapedText: string } } {
  return !!n && 'name' in n && typeof n.name === 'object' && !!n.name && 'escapedText' in n.name && !!n.name.escapedText;
}

function isRedefinableDeclaration(x: ts.Node): x is ts.InterfaceDeclaration | ts.ClassDeclaration | ts.FunctionDeclaration {
  return ts.isFunctionDeclaration(x) || ts.isClassDeclaration(x) || ts.isInterfaceDeclaration(x);
}

/**
 * Transformer runtime state
 */
export class TransformerState implements State {
  #resolver: SimpleResolver;
  #imports: ImportManager;
  #modIdent: ts.Identifier;
  #manifestIndex: ManifestIndex;
  #syntheticIdentifiers = new Map<string, ts.Identifier>();
  #decorators = new Map<string, ts.PropertyAccessExpression>();

  added = new Map<number, ts.Statement[]>();
  importName: string;
  file: string;
  source: ts.SourceFile;
  factory: ts.NodeFactory;

  constructor(source: ts.SourceFile, factory: ts.NodeFactory, checker: ts.TypeChecker, manifestIndex: ManifestIndex) {
    this.#manifestIndex = manifestIndex;
    this.#resolver = new SimpleResolver(checker, manifestIndex);
    this.#imports = new ImportManager(source, factory, this.#resolver);
    this.file = path.toPosix(source.fileName);
    this.importName = this.#resolver.getFileImportName(this.file);
    this.source = source;
    this.factory = factory;
  }

  /**
   * Rewrite module specifier normalizing output
   */
  normalizeModuleSpecifier<T extends ts.Expression | undefined>(spec: T): T {
    return this.#imports.normalizeModuleSpecifier(spec);
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
   * Read all JSDoc tags as a list, with split support
   */
  readDocTagList(node: ts.Declaration, name: string): string[] {
    return this.readDocTag(node, name)
      .flatMap(x => x.split(/\s*,\s*/g))
      .map(x => x.replace(/`/g, ''))
      .filter(x => !!x);
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
      ident.escapedText?.toString()! :
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
      .filter(x => !!x) : [];
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
      if (!ts.isStatement(n)) {
        throw new Error('Unable to find statement at top level');
      }
      if (n && ts.isSourceFile(n.parent) && stmts.indexOf(n) >= 0) {
        idx = stmts.indexOf(n) - 1;
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
  finalize(source: ts.SourceFile): ts.SourceFile {
    return this.#imports.finalize(source);
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
    return LiteralUtil.fromLiteral(this.factory, val!);
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
  getModuleIdentifier(): ts.Expression {
    if (this.#modIdent === undefined) {
      this.#modIdent = this.factory.createUniqueName('mod');
      const entry = this.#resolver.getFileImport(this.source.fileName);
      const decl = this.factory.createVariableDeclaration(this.#modIdent, undefined, undefined,
        this.fromLiteral([entry?.module, entry?.relativeFile ?? ''])
      );
      this.addStatements([
        this.factory.createVariableStatement([], this.factory.createVariableDeclarationList([decl]))
      ], -1);
    }
    return this.#modIdent;
  }

  /**
   * Find decorator, relative to registered key
   * @param state
   * @param node
   * @param name
   * @param module
   */
  findDecorator(mod: string | Transformer, node: ts.Node, name: string, module?: string): ts.Decorator | undefined {
    module = module?.replace(/[.]ts$/, ''); // Replace extension if exists
    mod = typeof mod === 'string' ? mod : mod[ModuleNameSymbol]!;
    const target = `${mod}:${name}`;
    const list = this.getDecoratorList(node);
    return list.find(x => x.targets?.includes(target) && (!module || x.name === name && x.module === module))?.dec;
  }

  /**
   * Generate unique identifier for node
   * @param node
   * @param type
   */
  generateUniqueIdentifier(node: ts.Node, type: AnyType, suffix?: string): string {
    let unique: string[] = [];
    let name = type.name && !type.name.startsWith('_') ? type.name : '';
    if (!name && hasEscapedName(node)) {
      name = `${node.name.escapedText}`;
    }
    name ||= 'Shape';

    try {
      // Tie to source location if possible
      const tgt = DeclarationUtil.getPrimaryDeclarationNode(type.original!);
      const fileName = tgt.getSourceFile().fileName;

      if (fileName === this.source.fileName) { // if in same file suffix with location
        let child: ts.Node = tgt;
        while (child && !ts.isSourceFile(child)) {
          if (isRedefinableDeclaration(child) || ts.isMethodDeclaration(child) || ts.isParameter(child)) {
            if (child.name) {
              unique.push(child.name.getText());
            }
          }
          child = child.parent;
        }

        if (!unique.length) {
          unique.push(ts.getLineAndCharacterOfPosition(tgt.getSourceFile(), tgt.getStart()).line.toString());
        }
      } else {
        // Otherwise treat it as external and add nothing to it
      }
    } catch {
      unique = [type.name ?? 'unknown']; // Type is only unique piece
    }

    if (unique.length) { // Make unique to file
      unique.unshift(this.#resolver.getFileImportName(this.source.fileName));
      return `${name}__${SystemUtil.naiveHashString(unique.join(':'), 12)}${suffix || ''}`;
    } else {
      return name;
    }
  }

  /**
   * Register synthetic identifier
   */
  registerIdentifier(id: string): [identifier: ts.Identifier, exists: boolean] {
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
   * Produce a foreign target type
   */
  getForeignTarget(ret: ForeignType): ts.Expression {
    return this.fromLiteral({
      Ⲑid: `${ret.source.split('node_modules/')[1]}+${ret.name}`
    });
  }

  /**
   * Return a concrete type the given type of a node
   */
  getConcreteType(node: ts.Node): ts.Expression {
    const type = this.resolveType(node);

    if (type.key === 'managed') {
      return this.getOrImport(type);
    } else if (type.key === 'foreign') {
      return this.getForeignTarget(type);
    } else {
      const file = node.getSourceFile().fileName;
      const src = this.getFileImportName(file);
      throw new Error(`Unable to import non-external type: ${node.getText()} ${type.key}: ${src}`);
    }
  }

  /**
   * Get apparent type of requested field
   */
  getApparentTypeOfField(value: ts.Type, field: string): AnyType | undefined {
    const checker = this.#resolver.getChecker();
    const props = checker.getApparentType(value).getApparentProperties().find(x => x.escapedName === field);
    return props ? this.resolveType(checker.getTypeOfSymbol(props)) : undefined;
  }
}