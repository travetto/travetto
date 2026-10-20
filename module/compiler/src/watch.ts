import { execFile } from 'node:child_process';
import { watch } from 'node:fs';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';

import { ManifestFileUtil, ManifestModuleUtil, ManifestUtil, PACKAGE_MANAGERS, PackageUtil, path } from '@travetto/manifest';

import { EventUtil } from './event.ts';
import { IpcLog as log } from './log.ts';
import { AsyncQueue } from './queue.ts';
import type { CompilerState } from './state.ts';
import { CompilerReset, type CompilerWatchEvent, type CompileStateEntry } from './types.ts';

const executeFile = promisify(execFile);
const fromLines = <K extends string[]>(output: string, ...keys: K): Record<K[number], string> | undefined => {
  const lines = output
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean);
  if (!lines.length) {
    return;
  }
  return Object.fromEntries(keys.map((key, idx) => [key, lines[idx]])) as Record<K[number], string>;
};

type CompilerWatchEventCandidate = Omit<CompilerWatchEvent, 'entry'> & { entry?: CompileStateEntry };

export class CompilerWatcher {
  #state: CompilerState;
  #cleanup: Partial<Record<'tool' | 'workspace' | 'canary' | 'git', () => void | Promise<void>>> = {};
  #watchCanary: string = '.trv/canary.id';
  #lastWorkspaceModified: number;
  #watchCanaryFrequency = 5;
  #root: string;
  #queue: AsyncQueue<CompilerWatchEvent>;

  constructor(state: CompilerState, signal: AbortSignal) {
    this.#state = state;
    this.#root = state.manifest.workspace.path;
    this.#queue = new AsyncQueue(signal);
    signal.addEventListener('abort', () =>
      Object.values(this.#cleanup).forEach(fn => {
        fn?.();
      })
    );
  }

  async #getWatchIgnores(): Promise<string[]> {
    const pkg = PackageUtil.readPackage(this.#root);
    const patterns = [...(pkg?.travetto?.build?.watchIgnores ?? []), '**/node_modules', '.*/**/node_modules'];
    const ignores = new Set(['node_modules', '.git', this.#state.resolveOutputFile('.')]);
    for (const item of patterns) {
      if (item.includes('*')) {
        for await (const sub of fs.glob(item, { cwd: this.#root })) {
          if (sub.startsWith('node_modules')) {
            // Continue
          } else if (sub.endsWith('/node_modules')) {
            ignores.add(sub.split('/node_modules')[0]);
          } else {
            ignores.add(sub);
          }
        }
      } else {
        ignores.add(item);
      }
    }
    return [...ignores].toSorted().map(ignore => (ignore.endsWith('/') ? ignore : `${ignore}/`));
  }

  #toCandidateEvent({ action, file }: Pick<CompilerWatchEvent, 'action' | 'file'>): CompilerWatchEventCandidate {
    let entry = this.#state.getBySource(file);
    const module = entry?.module ?? this.#state.manifestIndex.findModuleForArbitraryFile(file);

    if (module && action === 'create' && !entry) {
      const moduleRoot = module.sourceFolder || this.#root;
      const moduleFile = file.includes(`${moduleRoot}/`) ? file.split(`${moduleRoot}/`)[1] : file;
      entry = this.#state.registerInput(module, moduleFile);
    } else if (action === 'delete' && entry) {
      this.#state.removeSource(entry.sourceFile); // Ensure we remove it
    }

    return { entry, file: entry?.sourceFile ?? file, action, moduleFile: entry?.moduleFile ?? '' };
  }

  #isValidFile(file: string): boolean {
    const relativeFile = file.replace(`${this.#root}/`, '');
    if (relativeFile === this.#watchCanary) {
      return false;
    } else if (relativeFile.startsWith('.')) {
      return false;
    } else if (!ManifestModuleUtil.isSourceType(file)) {
      return false;
    }
    return true;
  }

  #isValidEvent(event: CompilerWatchEventCandidate): event is CompilerWatchEvent {
    if (!event.entry) {
      log.debug(`Skipping unknown file ${event.file}`);
      return false;
    } else if ((event.action === 'update' || event.action === 'create') && !this.#state.checkIfSourceChanged(event.entry.sourceFile)) {
      const relativeFile = event.file.replace(`${this.#root}/`, '');
      log.debug(`Skipping ${event.action}, as contents unchanged ${relativeFile}`);
      return false;
    }
    return true;
  }

  async #updateManifestWithEvents(compilerEvents: CompilerWatchEvent[]): Promise<void> {
    const eventsByModule = this.#state.manifestIndex.groupByLineage(
      compilerEvents.map(event => ({ item: event, module: event.entry!.module.name })).filter(x => x.item.action !== 'update')
    );

    for (const [moduleName, events] of eventsByModule.entries()) {
      const moduleManifest = this.#state.manifestIndex.resolveDependentManifest(moduleName);
      for (const { moduleFile, action, entry } of events) {
        ManifestUtil.updateManifest(moduleManifest, entry.module.name, moduleFile, action);
      }
      log.debug('Updating manifest', [{ module: moduleName, events: events.length }]);
      await ManifestUtil.writeManifest(moduleManifest);
    }

    this.#state.manifestIndex.init(ManifestUtil.getManifestLocation(this.#state.manifest));
  }

  async #listenWorkspace(): Promise<void> {
    const lib = await import('@parcel/watcher');
    const ignore = await this.#getWatchIgnores();
    const packageFiles = new Set(
      ['package.json', ...PACKAGE_MANAGERS.flatMap(x => [x.workspaceFile!, x.lock].filter(Boolean))].map(file =>
        path.resolve(this.#root, file)
      )
    );

    log.debug('Ignore Globs', ignore);
    log.debug('Watching', this.#root);

    await this.#cleanup.workspace?.();

    const listener = await lib.subscribe(
      this.#root,
      async (error, events) => {
        this.#lastWorkspaceModified = Date.now();

        try {
          if (error) {
            throw error instanceof Error ? error : new Error(`${error}`);
          }

          // One event per file set
          const filesChanged = events
            .map(event => ({ file: path.toPosix(event.path), action: event.type }))
            .filter(event => this.#isValidFile(event.file));

          if (filesChanged.length) {
            EventUtil.sendEvent('file', { workspace: this.#state.manifest.workspace.path, time: Date.now(), files: filesChanged });
          }

          const changedPackageFiles = events
            .map(event => path.toPosix(event.path))
            .filter(file => packageFiles.has(file))
            .map(file => path.relative(this.#root, file));
          if (changedPackageFiles.length) {
            throw new CompilerReset('Package information changed', changedPackageFiles);
          }

          const changedCompilerFiles = filesChanged
            .filter(item => this.#state.isCompilerFile(item.file))
            .map(item => path.relative(this.#root, item.file));
          if (changedCompilerFiles.length) {
            throw new CompilerReset('Compiler source changed', changedCompilerFiles);
          }

          const items = filesChanged.map(event => this.#toCandidateEvent(event)).filter(event => this.#isValidEvent(event));

          if (items.length === 0) {
            return;
          }

          try {
            await this.#updateManifestWithEvents(items);
          } catch (manifestError) {
            throw new CompilerReset('Manifest rebuild failure');
          }

          for (const item of items) {
            this.#queue.add(item);
          }
        } catch (out) {
          if (out instanceof Error) {
            if (out.message.includes('Events were dropped by the FSEvents client.')) {
              this.#queue.throw(new CompilerReset('FSEvents failure'));
            } else {
              this.#queue.throw(out);
            }
          } else {
            this.#queue.throw(new Error(`${out}`));
          }
        }
      },
      { ignore }
    );

    this.#cleanup.workspace = (): Promise<void> => listener.unsubscribe();
  }

  async #listenToolFolder(): Promise<void> {
    const build = this.#state.manifest.build;
    const toolRootFolder = path.dirname(path.resolve(this.#root, build.outputFolder));
    const toolFolders = new Set([toolRootFolder, build.typesFolder, build.outputFolder].map(folder => path.resolve(this.#root, folder)));

    log.debug(
      'Tooling Folders',
      [...toolFolders].map(folder => folder.replace(`${this.#root}/`, ''))
    );

    await this.#cleanup.tool?.();

    const listener = watch(toolRootFolder, { encoding: 'utf8' }, async (event, file) => {
      if (!file) {
        return;
      }
      const full = path.resolve(toolRootFolder, file);
      const stat = await fs.stat(full, { throwIfNoEntry: false });
      if (toolFolders.has(full) && !stat) {
        this.#queue.throw(new CompilerReset('Tooling folder removed', [path.relative(this.#root, full)]));
      }
    });
    this.#cleanup.tool = (): void => listener.close();
  }

  async #listenCanary(): Promise<void> {
    await this.#cleanup.canary?.();
    const full = path.resolve(this.#root, this.#watchCanary);
    await ManifestFileUtil.bufferedFileWrite(full, '');
    this.#lastWorkspaceModified = Date.now();

    log.debug('Starting workspace canary');
    const canaryId = setInterval(async () => {
      const delta = Math.trunc((Date.now() - this.#lastWorkspaceModified) / 1000);
      if (delta > 600) {
        log.error('Restarting canary due to extra long delay');
        this.#lastWorkspaceModified = Date.now(); // Reset
      } else if (delta > this.#watchCanaryFrequency * 2) {
        this.#queue.throw(new CompilerReset(`Workspace watch stopped responding ${delta}s ago`));
      } else if (delta > this.#watchCanaryFrequency) {
        log.error('Restarting parcel due to inactivity');
        await this.#listenWorkspace();
      } else {
        await fs.utimes(full, new Date(), new Date());
      }
    }, this.#watchCanaryFrequency * 1000);

    this.#cleanup.canary = (): void => clearInterval(canaryId);
  }

  async #getGitHeadRef(): Promise<{ hash: string; ref: string } | undefined> {
    return executeFile('git', ['rev-parse', 'HEAD', '--symbolic-full-name', 'HEAD'], { cwd: this.#root }).then(
      ({ stdout }) => fromLines(stdout, 'hash', 'ref'),
      () => undefined
    );
  }

  async #getGitDirectories(): Promise<{ gitDirectory: string; commonDirectory: string } | undefined> {
    return await executeFile('git', ['rev-parse', '--git-dir', '--git-common-dir'], { cwd: this.#root }).then(
      ({ stdout }) => fromLines(stdout, 'gitDirectory', 'commonDirectory'),
      () => undefined
    );
  }

  async #listenGitChanges(): Promise<void> {
    const directories = await this.#getGitDirectories();
    if (!directories) {
      return;
    }
    const { gitDirectory, commonDirectory } = directories;

    log.debug('Starting git canary in', gitDirectory);
    let currentHead = await this.#getGitHeadRef();
    let isChecking: Promise<void> | undefined;

    const checkChange = async (): Promise<void> => {
      try {
        const nextHead = await this.#getGitHeadRef();
        if (nextHead && currentHead && (nextHead.hash !== currentHead.hash || nextHead.ref !== currentHead.ref)) {
          currentHead = nextHead;
          this.#queue.throw(
            new CompilerReset(
              `Git branch or commit change detected: ${currentHead.hash}(${currentHead.ref})=>${nextHead.hash}(${nextHead.ref})`,
              undefined,
              'hard-restart'
            )
          );
        }
      } finally {
        isChecking = undefined;
      }
    };

    const watchers: { close(): void }[] = [];
    const targets = [
      {
        folder: path.resolve(this.#root, gitDirectory),
        filter: (file?: string | null): boolean => !file || /^(HEAD|packed-refs|refs)/.test(file)
      },
      { folder: path.resolve(this.#root, commonDirectory, 'refs', 'heads'), filter: (): boolean => true }
    ];

    for (const { folder, filter } of targets) {
      if (await fs.stat(folder, { throwIfNoEntry: false })) {
        watchers.push(watch(folder, { encoding: 'utf8' }, (_, file) => filter(file) && (isChecking ??= checkChange())));
      }
    }

    this.#cleanup.git = (): void => {
      watchers.forEach(watcher => watcher.close());
    };
  }

  add(file: string): void {
    if (this.#queue.has(item => item.file === file)) {
      return;
    }
    this.#state.resetSourceHash(file);
    const candidate = this.#toCandidateEvent({ action: 'update', file });
    if (this.#isValidEvent(candidate)) {
      this.#queue.add(candidate);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<CompilerWatchEvent> {
    if (!this.#cleanup.workspace) {
      this.#listenWorkspace();
      this.#listenToolFolder();
      this.#listenCanary();
      this.#listenGitChanges();
    }
    return this.#queue[Symbol.asyncIterator]();
  }
}
