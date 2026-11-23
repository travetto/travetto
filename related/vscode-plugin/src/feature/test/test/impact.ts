import * as vscode from 'vscode';

type SymbolQueueItem = {
  uri: vscode.Uri;
  position: vscode.Position;
  depth: number;
};

const MAX_TRAVERSAL_DEPTH = 4;
const MAX_LSP_QUERIES = 50;

/**
 * Resolves downstream impacted test files using VS Code's Language Server (DocumentSymbol + ReferenceProvider)
 */
export class TestImpactResolver {
  async #getSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
    return (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri)) ?? [];
  }

  #collectTargetSymbols(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
    const collected: vscode.DocumentSymbol[] = [];
    const visit = (symbol: vscode.DocumentSymbol): void => {
      const isContainer = symbol.kind === vscode.SymbolKind.Class || symbol.kind === vscode.SymbolKind.Namespace || symbol.kind === vscode.SymbolKind.Module;
      if (!isContainer || symbol.children.length === 0) {
        collected.push(symbol);
      }
      if (isContainer) {
        for (const child of symbol.children) {
          visit(child);
        }
      }
    };
    for (const symbol of symbols) {
      visit(symbol);
    }
    return collected;
  }

  #findEnclosingSymbol(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | undefined {
    for (const symbol of symbols) {
      if (symbol.range.contains(position)) {
        return this.#findEnclosingSymbol(symbol.children, position) ?? symbol;
      }
    }
  }

  /**
   * Find test files impacted by symbols in a changed document
   */
  async findImpactedTests(
    document: vscode.TextDocument,
    isTestFile: (file: string) => boolean,
    isWorkspaceFile: (file: string) => boolean
  ): Promise<string[]> {
    const key = document.uri.toString();
    const rootSymbols = await this.#getSymbols(document.uri);
    const targetSymbols = this.#collectTargetSymbols(rootSymbols);
    if (targetSymbols.length === 0) {
      return [];
    }

    const impactedTests = new Set<string>();
    const visited = new Set<string>();
    const queue: SymbolQueueItem[] = [];
    const symbolCache = new Map<string, vscode.DocumentSymbol[]>([[key, rootSymbols]]);

    const enqueue = (uri: vscode.Uri, position: vscode.Position, depth: number): void => {
      const visitKey = `${uri.toString()}:${position.line}:${position.character}`;
      if (!visited.has(visitKey)) {
        visited.add(visitKey);
        queue.push({ uri, position, depth });
      }
    };

    for (const symbol of targetSymbols) {
      enqueue(document.uri, symbol.selectionRange.start, 0);
    }

    let queries = 0;
    while (queue.length > 0 && queries < MAX_LSP_QUERIES) {
      const current = queue.shift()!;
      queries += 1;

      const locations =
        (await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', current.uri, current.position)) ?? [];

      for (const location of locations) {
        const targetPath = location.uri.fsPath;
        if (targetPath === document.fileName && location.range.contains(current.position)) {
          continue;
        }
        if (isTestFile(targetPath)) {
          impactedTests.add(targetPath);
          continue;
        }
        if (current.depth + 1 < MAX_TRAVERSAL_DEPTH && isWorkspaceFile(targetPath)) {
          const targetKey = location.uri.toString();
          let fileSymbols = symbolCache.get(targetKey);
          if (!fileSymbols) {
            fileSymbols = await this.#getSymbols(location.uri);
            symbolCache.set(targetKey, fileSymbols);
          }
          const enclosing = this.#findEnclosingSymbol(fileSymbols, location.range.start);
          if (enclosing) {
            enqueue(location.uri, enclosing.selectionRange.start, current.depth + 1);
          }
        }
      }
    }

    return [...impactedTests];
  }
}
