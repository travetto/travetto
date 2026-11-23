import { ManifestModuleUtil } from '@travetto/manifest';

const IMPORT_EXPORT_REGEX = /(?:import|export)\s+(?:type\s+)?(?:([^'"`;]*?)\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_DECL_REGEX = /export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|function|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g;
const EXPORT_LIST_REGEX = /export\s+(?:type\s+)?\{([^}]+)\}(?!\s*from)/g;

export type ImportedSymbolSet = Set<string> | '*';

/**
 * Utilities for extracting static import/export metadata from source text
 */
export class TestImpactUtil {
  /**
   * Determine if a source file is a barrel index file
   */
  static isBarrel(sourceFile: string): boolean {
    return ManifestModuleUtil.withoutSourceExtension(sourceFile).endsWith('/__index__');
  }
  static #parseImportedClause(clause?: string): ImportedSymbolSet {
    if (!clause) {
      return '*';
    }
    const trimmed = clause.trim();
    if (!trimmed || trimmed.startsWith('*')) {
      return '*';
    }
    const symbols = new Set<string>();
    const braceStart = trimmed.indexOf('{');
    if (braceStart > 0) {
      const defaultName = trimmed.slice(0, braceStart).replace(',', '').trim();
      if (defaultName) {
        symbols.add('default');
      }
    } else if (braceStart === -1) {
      symbols.add('default');
      return symbols;
    }

    const braceMatch = trimmed.match(/\{([^}]*)\}/);
    if (braceMatch) {
      for (const part of braceMatch[1].split(',')) {
        const cleaned = part.trim().replace(/^type\s+/, '');
        if (!cleaned) {
          continue;
        }
        const name = cleaned.split(/\s+as\s+/)[0].trim();
        if (name) {
          symbols.add(name);
        }
      }
    }
    return symbols.size > 0 ? symbols : '*';
  }

  /**
   * Extract exported symbol names from source text
   */
  static extractExports(content: string): Set<string> {
    const exported = new Set<string>();
    for (const match of content.matchAll(EXPORT_DECL_REGEX)) {
      exported.add(match[1]);
    }
    for (const match of content.matchAll(EXPORT_LIST_REGEX)) {
      for (const part of match[1].split(',')) {
        const cleaned = part.trim().replace(/^type\s+/, '');
        if (!cleaned) {
          continue;
        }
        const aliasParts = cleaned.split(/\s+as\s+/);
        const target = (aliasParts[1] ?? aliasParts[0]).trim();
        if (target) {
          exported.add(target);
        }
      }
    }
    if (/export\s+default\b/.test(content)) {
      exported.add('default');
    }
    return exported;
  }

  /**
   * Extract module specifiers and imported symbol sets from source text
   */
  static extractImports(content: string): Map<string, ImportedSymbolSet> {
    const imports = new Map<string, ImportedSymbolSet>();
    for (const match of content.matchAll(IMPORT_EXPORT_REGEX)) {
      const specifier = match[2] ?? match[3];
      if (!specifier) {
        continue;
      }
      const parsed: ImportedSymbolSet = match[3] ? '*' : this.#parseImportedClause(match[1]);
      const existing = imports.get(specifier);
      if (existing === '*' || parsed === '*') {
        imports.set(specifier, '*');
      } else if (existing) {
        for (const symbol of parsed) {
          existing.add(symbol);
        }
      } else {
        imports.set(specifier, parsed);
      }
    }
    return imports;
  }

  /**
   * Extract module specifiers from source text without invoking the TypeScript compiler
   */
  static extractSpecifiers(content: string): string[] {
    return [...this.extractImports(content).keys()];
  }
}
