import vscode from 'vscode';
import timers from 'node:timers/promises';
import path from 'node:path';
import fs from 'node:fs';

import { IndexedFile, IndexedModule, type ManifestContext, ManifestIndex, ManifestModuleUtil, ManifestUtil, type NodePackageRunner, PackageUtil } from '@travetto/manifest';
import type { CompilerStateType } from '@travetto/compiler/support/types.ts';

const SUFFIXES = ['.ts', '.js', '.tsx', '.jsx', '.d.ts'];

/**
 * Standard set of workspace utilities
 */
export class Workspace {

  static #context: vscode.ExtensionContext;
  static #manifestContext: ManifestContext;
  static #workspaceIndex: ManifestIndex;
  static #compilerState: CompilerStateType = 'closed';
  static #compilerStateListeners: ((ev: CompilerStateType) => void)[] = [];
  static #importToFile: Record<string, string | undefined> = {};
  static #cliFile: string;
  static #compilerCliFile: string;

  static readonly folder: vscode.WorkspaceFolder;

  static get cliFile(): string {
    return this.#cliFile ??= this.resolveImport('@travetto/cli/bin/trv.js');
  }

  static get compilerCliFile(): string {
    return this.#compilerCliFile ??= this.resolveImport('@travetto/compiler/bin/trvc.js');
  }

  static onCompilerState(handler: (ev: CompilerStateType) => void): void {
    this.#compilerStateListeners.push(handler);
    handler(this.compilerState);
  }

  static get nodePackageRunner(): NodePackageRunner {
    return this.#manifestContext.workspace.runner;
  }

  static set compilerState(state: CompilerStateType) {
    if (state !== this.#compilerState) {
      this.#compilerState = state;
      for (const el of this.#compilerStateListeners) { el(this.compilerState); }
    }
  }

  /** Get the current compiler state */
  static get compilerState(): CompilerStateType {
    return this.#compilerState;
  }

  static get isCompilerWatching(): boolean {
    return this.#compilerState === 'watch-start';
  }

  /** Resolve an import to a file path */
  static resolveImport(imp: string): string {
    return PackageUtil.resolveImport(imp, this.path);
  }

  /** Get workspace output folder */
  static get outputFolder(): string {
    return this.#manifestContext.build.outputFolder;
  }

  /** Get workspace uri */
  static get uri(): vscode.Uri {
    return vscode.Uri.file(this.path);
  }

  /** Get workspace path */
  static get path(): string {
    return this.#manifestContext.workspace.path;
  }

  /** Get workspace module */
  static get moduleName(): string {
    return this.#manifestContext.workspace.name;
  }

  /** Get workspace index */
  static get workspaceIndex(): ManifestIndex {
    return this.#workspaceIndex ??= new ManifestIndex(ManifestUtil.getManifestLocation(this.#manifestContext));
  }

  /**
   * Initialize extension context
   * @param context
   */
  static async init(context: vscode.ExtensionContext, manifestContext: ManifestContext, folder: vscode.WorkspaceFolder): Promise<void> {
    this.#context = context;
    this.#manifestContext = manifestContext;
    // Overwrite "const"
    Object.assign(this, { folder });
  }

  /** Find full path for a resource */
  static getAbsoluteResource(rel: string): string {
    return this.#context.asAbsolutePath(rel);
  }

  /** See if an entity is an editor */
  static isEditor(o: unknown): o is vscode.TextEditor {
    return !!o && typeof o === 'object' && 'document' in o;
  }

  /** Get the editor for a doc */
  static getEditor(doc: vscode.TextDocument): vscode.TextEditor | undefined {
    for (const e of vscode.window.visibleTextEditors) {
      if (e.document === doc) {
        return e;
      }
    }
  }

  /** Show a message for a limited time, with the ability to dismiss */
  static async showEphemeralMessage(text: string, duration = 3000): Promise<void> {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification, title: text, cancellable: true,
    }, async (_, token) => {
      const ctrl = new AbortController();
      token.onCancellationRequested(() => ctrl.abort());
      await timers.setTimeout(duration, undefined, { signal: ctrl.signal }).catch(() => { });
    });
  }

  static reloadManifest() {
    this.workspaceIndex.reinitForModule(this.workspaceIndex.mainModule.name);
  }

  /**
   * Get a manifest index file, by file name
   */
  static resolveManifestIndexFileFromFile(file: string): [IndexedModule, IndexedFile] | undefined {
    let mod = this.workspaceIndex.getModuleFromSource(file);
    if (!mod) {
      this.reloadManifest();
      mod = this.workspaceIndex.getModuleFromSource(file);
    }

    const entry = this.workspaceIndex.getEntry(file);

    if (mod && entry) {
      return [mod, entry];
    }
  }

  /**
   * Try to get file location from import, relying on manifest
   */
  static resolveManifestFileFromImport(imp: string): string | undefined {
    let resolved = this.#importToFile[imp];

    // Special provision for local files
    if (!resolved && imp.startsWith(this.moduleName)) {
      const local = path.resolve(this.path, imp.replace(this.moduleName, '.'));
      if (fs.existsSync(local)) {
        resolved = local;
      }
    }

    const fileType = ManifestModuleUtil.getFileType(imp);

    for (let i = 0; i < 2 && !resolved; i += 1) {
      if (i === 1) {
        this.reloadManifest();
      }

      resolved ??= this.workspaceIndex.getFromImport(imp)?.sourceFile;

      if (!resolved && fileType === 'unknown') {
        for (const suffix of SUFFIXES) {
          resolved ??= this.workspaceIndex.getFromImport(`${imp}${suffix}`)?.sourceFile;
        }
      }
    }

    return this.#importToFile[imp] = resolved;
  }
}