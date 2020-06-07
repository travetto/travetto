import * as ts from 'typescript';

import { ExternalType, AnyType } from './resolver/types';
import { State, DecoratorMeta } from './types/visitor';

import { TypeResolver } from './resolver/service';
import { ImportManager } from './importer';
import { DocUtil } from './util/doc';
import { DecoratorUtil } from './util/decorator';
import { DeclarationUtil } from './util/declaration';

/**
 * Transformer runtime state
 */
export class TransformerState implements State {
  private resolver: TypeResolver;
  private imports: ImportManager;
  private decorators = new Map<string, ts.PropertyAccessExpression>();

  constructor(public source: ts.SourceFile, checker: ts.TypeChecker) {
    this.imports = new ImportManager(source);
    this.resolver = new TypeResolver(checker);
  }

  /**
   * Get or import the node or external type
   */
  getOrImport(type: ExternalType) {
    return this.imports.getOrImport(type);
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
      throw new Error(`Unable to import non-external type: ${node.getText()}`);
    }
    return resolved;
  }

  /**
   * Convert a type to it's identifier, will return undefined if none match
   */
  typeToIdentifier(node: ts.Type | AnyType) {
    const type = 'flags' in node ? this.resolveType(node) : node;
    switch (type.key) {
      case 'literal': return ts.createIdentifier(type.ctor!.name);
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
    if (!this.decorators.has(name)) {
      const ref = this.imports.importFile(pth);
      const ident = ts.createIdentifier(name);
      this.decorators.set(name, ts.createPropertyAccess(ref.ident, ident));
    }
    return this.decorators.get(name);
  }

  /**
   * Create a decorator to add functionality to a declaration
   */
  createDecorator(pth: string, name: string, ...contents: (ts.Expression | undefined)[]) {
    this.importDecorator(pth, name);
    return DecoratorUtil.createDecorator(this.decorators.get(name)!, ...contents);
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
      targets: DocUtil.readDocTag(this.resolver.getType(ident), 'augments').map(x => x.replace(/^.*?([^` ]+).*?$/, (_, b) => b)),
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
   * Find a matching decorator.  Will match by target by default, but
   * if name or file are specified, will include those as matching criteria.
   *
   * @param node
   * @param target Name of decorator group
   * @param name Specific name of decorator
   * @param file File of decorator
   */
  findDecorator(node: ts.Node, target: string, name?: string, file?: string) {
    return this.getDecoratorList(node).find(x =>
      x.targets?.includes(target)
      && (name === undefined || x.name === name)
      && (file === undefined || x.file === file)
    )?.dec;
  }

  /**
   * Get all declarations for a node
   */
  getDeclarations(node: ts.Node): ts.Declaration[] {
    return DeclarationUtil.getDeclarations(this.resolver.getType(node));
  }

  /**
   * Finalize the source file for emission
   */
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