import ts from 'typescript';

import { path, ManifestIndex, ManifestModuleUtil, IndexedFile } from '@travetto/manifest';

import type { AnyType, TransformResolver } from './types';
import { TypeCategorize, TypeBuilder } from './builder';
import { VisitCache } from './cache';
import { DocUtil } from '../util/doc';
import { DeclarationUtil } from '../util/declaration';

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
      sourceFile = `${sourceFile}.ts`;
    }

    return this.#manifestIndex.getEntry(ManifestModuleUtil.getFileType(sourceFile) === 'ts' ? sourceFile : `${sourceFile}.js`) ??
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
    const ogSource = DeclarationUtil.getPrimaryDeclarationNode(type)?.getSourceFile()?.fileName;
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
   * @param el
   */
  getType(el: ts.Type | ts.Node): ts.Type {
    return 'getSourceFile' in el ? this.#tsChecker.getTypeAtLocation(el) : el;
  }

  /**
   * Fetch all type arguments for a give type
   */
  getAllTypeArguments(ref: ts.Type): ts.Type[] {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.#tsChecker.getTypeArguments(ref as ts.TypeReference) as ts.Type[];
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
    return this.#tsChecker.getPropertiesOfType(type);
  }

  /**
   * Resolve an `AnyType` from a `ts.Type` or a `ts.Node`
   */
  resolveType(node: ts.Type | ts.Node, importName: string): AnyType {
    const visited = new VisitCache();
    const resolve = (resType: ts.Type, alias?: ts.Symbol, depth = 0): AnyType => {

      if (depth > 20) { // Max depth is 20
        throw new Error('Object structure too nested');
      }

      const { category, type } = TypeCategorize(this, resType);
      const { build, finalize } = TypeBuilder[category];

      let result = build(this, type, alias);

      // Convert via cache if needed
      result = visited.getOrSet(type, result);

      // Recurse
      if (result) {
        result.original = resType;
        result.comment = DocUtil.describeDocs(type).description;

        if ('tsTypeArguments' in result) {
          result.typeArguments = result.tsTypeArguments!.map((elType, i) => resolve(elType, type.aliasSymbol, depth + 1));
          delete result.tsTypeArguments;
        }
        if ('tsFieldTypes' in result) {
          const fields: Record<string, AnyType> = {};
          for (const [name, fieldType] of Object.entries(result.tsFieldTypes ?? [])) {
            fields[name] = resolve(fieldType, undefined, depth + 1);
          }
          result.fieldTypes = fields;
          delete result.tsFieldTypes;
        }
        if ('tsSubTypes' in result) {
          result.subTypes = result.tsSubTypes!.map((elType, i) => resolve(elType, type.aliasSymbol, depth + 1));
          delete result.tsSubTypes;
        }
        if (finalize) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          result = finalize(result as never);
        }
      }

      return result ?? { key: 'literal', ctor: Object, name: 'object' };
    };

    try {
      return resolve(this.getType(node));
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      console.error(`Unable to resolve type in ${importName}`, err.stack);
      return { key: 'literal', ctor: Object, name: 'object' };
    }
  }
}