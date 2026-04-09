import ts from 'typescript';

import { path, type ManifestIndex, ManifestModuleUtil, type IndexedFile } from '@travetto/manifest';

import type { AnyType, ResolverContext, TransformResolver } from './types.ts';
import { TypeCategorize, TypeBuilder } from './builder.ts';
import { VisitCache } from './cache.ts';
import { DocUtil } from '../util/doc.ts';
import { DeclarationUtil } from '../util/declaration.ts';
import { transformCast } from '../types/shared.ts';

const isFinalizeType = (key: string): key is keyof typeof TypeBuilder => key in TypeBuilder;

/**
 * Implementation of TransformResolver
 */
export class SimpleResolver implements TransformResolver {
  #tsChecker: ts.TypeChecker;
  #manifestIndex: ManifestIndex;

  constructor(tsChecker: ts.TypeChecker, manifestIndex: ManifestIndex) {
    this.#tsChecker = tsChecker;
    this.#manifestIndex = manifestIndex;
  }

  /**
   * Get type checker
   * @private
   */
  getChecker(): ts.TypeChecker {
    return this.#tsChecker;
  }

  /**
   * Resolve an import for a file
   */
  getFileImport(file: string): IndexedFile | undefined {
    let sourceFile = path.toPosix(file);

    const type = ManifestModuleUtil.getFileType(file);

    if (type !== 'js' && type !== 'ts') {
      sourceFile = `${sourceFile}${ManifestModuleUtil.SOURCE_DEF_EXT}`;
    }

    const sourceType = ManifestModuleUtil.getFileType(sourceFile);

    return this.#manifestIndex.getEntry((sourceType === 'ts' || sourceType === 'js') ? sourceFile : undefined!) ??
      this.#manifestIndex.getFromImport(ManifestModuleUtil.withoutSourceExtension(sourceFile).replace(/^.*node_modules\//, ''));
  }

  /**
   * Resolve an import name (e.g. @module/path/file) for a file
   */
  getFileImportName(file: string, removeExt?: boolean): string {
    const imp = this.getFileImport(file)?.import ?? file;
    return removeExt ? ManifestModuleUtil.withoutSourceExtension(imp) : imp;
  }

  /**
   * Resolve an import name (e.g. @module/path/file) for a type
   */
  getTypeImportName(type: ts.Type, removeExt?: boolean): string | undefined {
    const ogSource = DeclarationUtil.getOptionalPrimaryDeclarationNode(type)?.getSourceFile()?.fileName;
    return ogSource ? this.getFileImportName(ogSource, removeExt) : undefined;
  }

  /**
   * Is the file/import known to the index, helpful for determine ownership
   */
  isKnownFile(fileOrImport: string): boolean {
    return (this.#manifestIndex.getFromSource(fileOrImport) !== undefined) ||
      (this.#manifestIndex.getFromImport(fileOrImport) !== undefined);
  }

  /**
   * Get type from element
   * @param value
   */
  getType(value: ts.Type | ts.Node): ts.Type {
    return 'getSourceFile' in value ? this.#tsChecker.getTypeAtLocation(value) : value;
  }

  /**
   * Fetch all type arguments for a give type
   */
  getAllTypeArguments(ref: ts.Type): [templateName: string, type: ts.Type][] {
    const types = this.#tsChecker.getTypeArguments(transformCast(ref));
    let names: string[] | undefined;
    if (ref.symbol.declarations?.[0]) {
      const first = ref.symbol.declarations[0];
      if (ts.isClassLike(first) || ts.isInterfaceDeclaration(first) || ts.isTypeAliasDeclaration(first)) {
        names = first.typeParameters?.map(tp => tp.name.getText()) ?? [];
      }
    }
    return transformCast(types.map((type, i) => [names?.[i] ?? '$', type]));
  }

  /**
   * Resolve the return type for a method
   */
  getReturnType(node: ts.MethodDeclaration): ts.Type {
    const type = this.getType(node);
    const [sig] = type.getCallSignatures();
    return this.#tsChecker.getReturnTypeOfSignature(sig);
  }

  /**
   * Get type as a string representation
   */
  getTypeAsString(type: ts.Type): string | undefined {
    return this.#tsChecker.typeToString(this.#tsChecker.getApparentType(type)) || undefined;
  }

  /**
   * Get list of properties
   */
  getPropertiesOfType(type: ts.Type): ts.Symbol[] {
    return this.#tsChecker.getPropertiesOfType(type)
      .filter(property => property.getName() !== '__proto__' && property.getName() !== 'prototype');
  }

  /**
   * Resolve an `AnyType` from a `ts.Type` or a `ts.Node`
   */
  resolveType(node: ts.Type | ts.Node | ts.TypeReference, importName: string): AnyType {
    const visited = new VisitCache();
    const resolve = (resType: ts.Type, context?: Omit<ResolverContext, 'node' | 'importName'>): AnyType => {
      const { depth = 0 } = context ?? {};

      if (depth > 20) { // Max depth is 20
        throw new Error(`Object structure too nested: ${'getText' in node ? node.getText() : ''}`);
      }

      const { category, type } = TypeCategorize(this, resType);
      // TODO: Figure out how to get this legitimately
      const typeArguments: ts.Type[] =
        'resolvedTypeArguments' in resType && resType.resolvedTypeArguments ? transformCast(resType.resolvedTypeArguments) : [];

      let result = TypeBuilder[category].build(this, type, { ...context, node: (node && 'kind' in node) ? node : undefined, importName });

      // Convert via cache if needed
      result = visited.getOrSet(type, result);

      // Recurse
      if (result) {
        result.original = resType;
        result.templateTypeName = context?.templateTypeName;

        try {
          result.comment = DocUtil.describeDocs(type).description;
        } catch { }

        if ('tsTypeArguments' in result) {
          const tsTypeArguments = result.tsTypeArguments!;
          if (typeArguments.length) {
            result.typeArguments = typeArguments.map((item, i) => resolve(item, { alias: type.aliasSymbol, templateTypeName: tsTypeArguments[i][0], depth: depth + 1 }));
          } else {
            result.typeArguments = tsTypeArguments.map((item) => resolve(item[1], { alias: type.aliasSymbol, templateTypeName: item[0], depth: depth + 1 }));
          }
          delete result.tsTypeArguments;
        }
        if ('tsFieldTypes' in result) {
          const fields: Record<string, AnyType> = {};
          for (const [name, fieldType] of Object.entries(result.tsFieldTypes ?? [])) {
            fields[name] = resolve(fieldType, { depth: depth + 1 });
          }
          result.fieldTypes = fields;
          delete result.tsFieldTypes;
        }
        if ('tsSubTypes' in result) {
          result.subTypes = result.tsSubTypes!.map((item) => resolve(item, { alias: type.aliasSymbol, depth: depth + 1 }));
          delete result.tsSubTypes;
        }
        if (isFinalizeType(result.key)) {
          result = TypeBuilder[result.key].finalize?.(transformCast(result)) ?? result;
        }
      }

      return result ?? { key: 'literal', ctor: Object, name: 'object' };
    };

    try {
      return resolve(this.getType(node));
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      console.error(`Unable to resolve type in ${importName}`, error.stack);
      return { key: 'literal', ctor: Object, name: 'object' };
    }
  }
}