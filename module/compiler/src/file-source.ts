import { Env, AppInfo, ScanApp, FilePresenceManager } from '@travetto/base';
import { Compiler } from './compiler';

export class FileChangeSource {

  private presenceManager: FilePresenceManager;

  constructor(private rootPaths: string[]) {
    const sourcedRootPaths = [
      ...rootPaths,
      ...(rootPaths.length && !rootPaths.includes('.') ? ['.'] : [])
    ];

    this.presenceManager = new FilePresenceManager({
      ext: '.ts',
      cwd: Env.cwd,
      rootPaths: sourcedRootPaths,
      listener: {
        added: (name: string) => {
          if (Compiler.transpile(name)) {
            this.onFileAdded(name);
          }
        },
        changed: (name: string) => {
          if (Compiler.transpile(name, true)) {
            this.onFileChanged(name);
          }
        },
        removed: (name: string) => {
          this.onFileRemoved(name);
        }
      },
      excludedFiles: [/node_modules/, /[.]d[.]ts$/],
      initialFileValidator: x => !(x.file in require.cache)
    });
  }

  onFileAdded(fileName: string) {
    if (this.presenceManager.isWatchedFileKnown(fileName.replace(/[.]js$/, '.ts'))) {
      Compiler.unload(fileName, false);
    }
    require(fileName);
  }

  onFileChanged(fileName: string) {
    Compiler.unload(fileName, false);
    require(fileName);
  }

  onFileRemoved(fileName: string) {
    Compiler.unload(fileName);
  }

  reset() {
    this.presenceManager.reset();
  }

  async init() {

    this.presenceManager.init();

    if (this.rootPaths.length) {
      const rootsRe = Env.appRootMatcher(this.rootPaths);

      const entries = await ScanApp.findFiles('.ts', (f: string) => {
        return this.presenceManager.validFile(f)
          && (rootsRe.test(f) || f.startsWith('extension/') || (
            /^node_modules\/@travetto\/[^\/]+\/(src|extension)\/.*/.test(f)
            && !f.includes('node_modules/@travetto/test') // Exclude test code by default
            && !f.startsWith(`node_modules/${AppInfo.NAME}/`)
          )); // No more side effect code, load all files
      }
      );

      const files = entries.map(x => x.file);

      for (const f of files) { // Load all files, class scanning
        require(f);
      }
    }
  }
}