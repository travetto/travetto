import ts from 'typescript';

import { path, type ManifestIndex } from '@travetto/manifest';

import type { ManagedType, AnyType, ForeignType, MappedType } from './resolver/types.ts';
import { type State, type DecoratorMeta, type Transformer, ModuleNameSymbol } from './types/visitor.ts';
import { SimpleResolver } from './resolver/service.ts';
import { ImportManager } from './importer.ts';
import type { Import } from './types/shared.ts';

import { DocUtil } from './util/doc.ts';
import { DecoratorUtil } from './util/decorator.ts';
import { DeclarationUtil } from './util/declaration.ts';
import { CoreUtil } from './util/core.ts';
import { LiteralUtil } from './util/literal.ts';
import { SystemUtil } from './util/system.ts';

function hasOriginal(node: ts.Node): node is ts.Node & { original: ts.Node } {
  return !!node && !node.parent && 'original' in node && !!node.original;
}

function hasEscapedName(node: ts.Node): node is ts.Node & { name: { escapedText: string } } {
  return !!node && 'name' in node && typeof node.name === 'object' && !!node.name && 'escapedText' in node.name && !!node.name.escapedText;
}

function isRedefinableDeclaration(node: ts.Node): node is ts.InterfaceDeclaration | ts.ClassDeclaration | ts.FunctionDeclaration {
  return ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node);
}

const FOREIGN_TYPE_REGISTRY_FILE = '@travetto/runtime/src/function';

/**
 * Transformer runtime state
 */
export class TransformerState implements State {
  #resolver: SimpleResolver;
  #imports: ImportManager;
  #moduleIdentifier: ts.Identifier;
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
  getOrImport(type: ManagedType | MappedType): ts.Identifier | ts.PropertyAccessExpression {
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
      const source = this.#resolver.getFileImportName(file);
      throw new Error(`Unable to import non-external type: ${node.getText()} ${resolved.key}: ${source}`);
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
      .flatMap(tag => tag.split(/\s*,\s*/g))
      .map(tag => tag.replace(/`/g, ''))
      .filter(tag => !!tag);
  }

  /**
   * Import a decorator, generally to handle erasure
   */
  importDecorator(location: string, name: string): ts.PropertyAccessExpression | undefined {
    return this.#decorators.getOrInsertComputed(name, () => {
      const ref = this.#imports.importFile(location);
      const identifier = this.factory.createIdentifier(name);
      return this.factory.createPropertyAccessExpression(ref.identifier, identifier);
    });
  }

  /**
   * Create a decorator to add functionality to a declaration
   */
  createDecorator(location: string, name: string, ...contents: (ts.Expression | undefined)[]): ts.Decorator {
    this.importDecorator(location, name);
    return CoreUtil.createDecorator(this.factory, this.#decorators.get(name)!, ...contents);
  }

  /**
   * Read a decorator's metadata
   */
  getDecoratorMeta(decorator: ts.Decorator): DecoratorMeta | undefined {
    const identifier = DecoratorUtil.getDecoratorIdentifier(decorator);
    const type = this.#resolver.getType(identifier);
    const declaration = DeclarationUtil.getOptionalPrimaryDeclarationNode(type);
    const source = declaration?.getSourceFile().fileName;
    const moduleImport = source ? this.#resolver.getFileImportName(source, true) : undefined;
    const file = this.#manifestIndex.getFromImport(moduleImport ?? '')?.outputFile;
    const targets = DocUtil.readAugments(type);
    const example = DocUtil.readExample(type);
    const module = file ? moduleImport : undefined;
    const name = identifier ?
      identifier.escapedText?.toString()! :
      undefined;

    if (identifier && name) {
      return { decorator, identifier, file, module, targets, name, options: example };
    }
  }

  /**
   * Get list of all #decorators for a node
   */
  getDecoratorList(node: ts.Node): DecoratorMeta[] {
    return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? [])
      .map(decorator => this.getDecoratorMeta(decorator))
      .filter(metadata => !!metadata) : [];
  }

  /**
   * Get all declarations for a node
   */
  getDeclarations(node: ts.Node): ts.Declaration[] {
    return DeclarationUtil.getDeclarations(this.#resolver.getType(node));
  }

  /**
   * Register statement for inclusion in final output
   * @param added
   * @param before
   */
  addStatements(added: ts.Statement[], before?: ts.Node | number): void {
    const statements = this.source.statements.slice(0);
    let idx = statements.length + 1000;

    if (before && typeof before !== 'number') {
      let node = before;
      if (hasOriginal(node)) {
        node = node.original;
      }
      while (node && !ts.isSourceFile(node.parent) && node !== node.parent) {
        node = node.parent;
      }
      if (!ts.isStatement(node)) {
        throw new Error('Unable to find statement at top level');
      }
      if (node && ts.isSourceFile(node.parent) && statements.indexOf(node) >= 0) {
        idx = statements.indexOf(node) - 1;
      }
    } else if (before !== undefined) {
      idx = before;
    }
    this.added.getOrInsert(idx, []).push(...added);
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
  fromLiteral<T extends ts.Expression>(value: T): T;
  fromLiteral(value: undefined): ts.Identifier;
  fromLiteral(value: null): ts.NullLiteral;
  fromLiteral(value: object): ts.ObjectLiteralExpression;
  fromLiteral(value: unknown[]): ts.ArrayLiteralExpression;
  fromLiteral(value: string | boolean | number): ts.LiteralExpression;
  fromLiteral(value: unknown): ts.Node {
    return LiteralUtil.fromLiteral(this.factory, value!);
  }

  /**
   * Extend
   */
  extendObjectLiteral(source: object | ts.Expression, ...rest: (object | ts.Expression)[]): ts.ObjectLiteralExpression {
    return LiteralUtil.extendObjectLiteral(this.factory, source, ...rest);
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
  createStaticField(name: string, value: ts.Expression): ts.PropertyDeclaration {
    return CoreUtil.createStaticField(this.factory, name, value);
  }

  /**
   * Create identifier from node or text
   * @param name
   */
  createIdentifier(name: string | { getText(): string }): ts.Identifier {
    return this.factory.createIdentifier(typeof name === 'string' ? name : name.getText());
  }

  /**
   * Gets the module identifier target
   */
  getModuleIdentifierTarget(): [string | undefined, string] {
    const entry = this.#resolver.getFileImport(this.source.fileName);
    return [entry?.module, entry?.relativeFile ?? ''];
  }

  /**
   * Build a class identifier string
   */
  buildClassId(text: string): string {
    const [module, source] = this.getModuleIdentifierTarget();
    return `${module}:${source}#${text}`;
  }

  /**
   * Get filename identifier, regardless of module system
   */
  getModuleIdentifier(): ts.Expression {
    if (this.#moduleIdentifier === undefined) {
      this.#moduleIdentifier = this.factory.createUniqueName('Δm');
      const declaration = this.factory.createVariableDeclaration(this.#moduleIdentifier, undefined, undefined,
        this.fromLiteral(this.getModuleIdentifierTarget())
      );
      this.addStatements([
        this.factory.createVariableStatement([], this.factory.createVariableDeclarationList([declaration], ts.NodeFlags.Const))
      ], -1);
    }
    return this.#moduleIdentifier;
  }

  /**
   * Find decorator, relative to registered key
   * @param state
   * @param node
   * @param name
   * @param module
   */
  findDecorator(input: string | Transformer, node: ts.Node, name: string, module?: string): ts.Decorator | undefined {
    module = module?.replace(/[.]ts$/, ''); // Replace extension if exists
    const targetScope = typeof input === 'string' ? input : input[ModuleNameSymbol]!;
    const target = `${targetScope}:${name}`;
    const list = this.getDecoratorList(node);
    return list.find(item => item.targets?.includes(target) && (!module || item.name === name && item.module === module))?.decorator;
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
    const resolved = this.#syntheticIdentifiers.getOrInsertComputed(id, () => {
      exists = false;
      return this.factory.createIdentifier(id);
    });
    return [resolved, exists];
  }

  /**
   * Find a method declaration, by name
   * @param cls
   * @param method
   */
  findMethodByName(cls: ts.ClassLikeDeclaration | ts.Type, method: string): ts.MethodDeclaration | undefined {
    if ('getSourceFile' in cls) {
      return cls.members.find(
        (value): value is ts.MethodDeclaration => ts.isMethodDeclaration(value) && ts.isIdentifier(value.name) && value.name.escapedText === method
      );
    } else {
      const properties = this.#resolver.getPropertiesOfType(cls);
      for (const property of properties) {
        const declaration = property.declarations?.[0];
        if (declaration && property.escapedName === method && ts.isMethodDeclaration(declaration)) {
          return declaration;
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
  getForeignTarget(typeOrClassId: ForeignType | string): ts.Expression {
    const file = this.importFile(FOREIGN_TYPE_REGISTRY_FILE);
    return this.factory.createCallExpression(this.createAccess(
      file.identifier,
      this.factory.createIdentifier('foreignType'),
    ), [], [
      this.fromLiteral(typeof typeOrClassId === 'string' ? typeOrClassId : typeOrClassId.classId)
    ]);
  }

  /**
   * Return a concrete type the given type of a node
   */
  getConcreteType(node: ts.Node, fallback?: ts.Expression): ts.Expression {
    const type = this.resolveType(node);
    try {
      if (type.key === 'managed') {
        return this.getOrImport(type);
      } else if (type.key === 'foreign') {
        return this.getForeignTarget(type);
      } else {
        const targetId = this.buildClassId(node.getText());
        if (this.#resolver.isKnownFile(node.getSourceFile().fileName)) {
          return this.getForeignTarget(targetId);
        } else {
          throw new Error(`Unable to import non - external type: ${node.getText()} ${type.key}: ${targetId} `);
        }
      }
    } catch (err) {
      if (fallback) {
        return fallback;
      } else {
        throw err;
      }
    }
  }

  /**
   * Get apparent type of requested field
   */
  getApparentTypeOfField(value: ts.Type, field: string): AnyType | undefined {
    const checker = this.#resolver.getChecker();
    const properties = checker.getApparentType(value).getApparentProperties().find(property => property.escapedName === field);
    return properties ? this.resolveType(checker.getTypeOfSymbol(properties)) : undefined;
  }
}