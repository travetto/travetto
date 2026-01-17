import fs from 'node:fs/promises';
import { watch } from 'node:fs';

import { ManifestFileUtil, ManifestModuleUtil, ManifestUtil, PACKAGE_MANAGERS, PackageUtil, path } from '@travetto/manifest';

import { CompilerReset, type CompilerWatchEvent, type CompileStateEntry } from './types.ts';
import type { CompilerState } from './state.ts';

import { AsyncQueue } from './queue.ts';
import { IpcLogger } from './log.ts';
import { EventUtil } from './event.ts';

const log = new IpcLogger({ level: 'debug' });

type CompilerWatchEventCandidate = Omit<CompilerWatchEvent, 'entry'> & { entry?: CompileStateEntry };

export class CompilerWatcher {
  #state: CompilerState;
  #cleanup: Partial<Record<'tool' | 'workspace' | 'canary' | 'git', () => (void | Promise<void>)>> = {};
  #watchCanary: string = '.trv/canary.id';
  #lastWorkspaceModified = Date.now();
  #watchCanaryFrequency = 5;
  #root: string;
  #queue: AsyncQueue<CompilerWatchEvent>;

  constructor(state: CompilerState, signal: AbortSignal) {
    this.#state = state;
    this.#root = state.manifest.workspace.path;
    this.#queue = new AsyncQueue(signal);
    signal.addEventListener('abort', () => Object.values(this.#cleanup).forEach(fn => fn?.()));
  }

  async #getWatchIgnores(): Promise<string[]> {
    const pkg = PackageUtil.readPackage(this.#root);
    const patterns = [
      ...pkg?.travetto?.build?.watchIgnores ?? [],
      '**/node_modules',
      '.*/**/node_modules'
    ];
    const ignores = new Set(['node_modules', '.git', this.#state.resolveOutputFile('.')]);
    for (const item of patterns) {
      if (item.includes('*')) {
        for await (const sub of fs.glob(item, { cwd: this.#root })) {
          if (sub.startsWith('node_modules')) {
            continue;
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
    return [...ignores].toSorted().map(ignore => ignore.endsWith('/') ? ignore : `${ignore}/`);
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

    return { entry, file: entry?.sourceFile ?? file, action, moduleFile: entry?.moduleFile! };
  }

  #isValidFile(file: string): boolean {
    const relativeFile = file.replace(`${this.#root}/`, '');
    if (relativeFile === this.#watchCanary) {
      return false;
    } else if (relativeFile.startsWith('.')) {
      return false;
    }
    return true;
  }

  #isValidEvent(event: CompilerWatchEventCandidate): event is CompilerWatchEvent {
    if (!event.entry) {
      log.debug(`Skipping unknown file ${event.file}`);
      return false;
    } else if (event.action === 'update' && !this.#state.checkIfSourceChanged(event.entry.sourceFile)) {
      const relativeFile = event.file.replace(`${this.#root}/`, '');
      log.debug(`Skipping update, as contents unchanged ${relativeFile}`);
      return false;
    } else if (!ManifestModuleUtil.isSourceType(event.file)) {
      return false;
    }
    return true;
  }

  async #updateManifestWithEvents(compilerEvents: CompilerWatchEvent[]): Promise<void> {
    const eventsByModule = this.#state.manifestIndex.groupByLineage(
      compilerEvents.map(event => ({ item: event, module: event.entry!.module.name }))
        .filter(x => x.item.action !== 'update')
    );

    for (const [moduleName, events] of eventsByModule.entries()) {
      const moduleManifest = this.#state.manifestIndex.resolveDependentManifest(moduleName);
      for (const { moduleFile, action, entry } of events) {
        ManifestUtil.updateManifest(moduleManifest, entry.module.name, moduleFile, action);
      }
      log.debug('Updating manifest', { module: moduleName, events: events.length });
      await ManifestUtil.writeManifest(moduleManifest);
    }

    this.#state.manifestIndex.init(ManifestUtil.getManifestLocation(this.#state.manifest));
  }

  async #listenWorkspace(): Promise<void> {
    const lib = await import('@parcel/watcher');
    const ignore = await this.#getWatchIgnores();
    const packageFiles = new Set([
      'package.json',
      ...PACKAGE_MANAGERS.flatMap(x => x.files)
    ].map(file => path.resolve(this.#root, file)));

    log.debug('Ignore Globs', ignore);
    log.debug('Watching', this.#root);

    await this.#cleanup.workspace?.();

    const listener = await lib.subscribe(this.#root, async (error, events) => {
      this.#lastWorkspaceModified = Date.now();

      try {
        if (error) {
          throw error instanceof Error ? error : new Error(`${error}`);
        } else if (events.length > 25) {
          throw new CompilerReset(`Large influx of file changes: ${events.length}`);
        } else if (events.some(event => packageFiles.has(path.toPosix(event.path)))) {
          throw new CompilerReset('Package information changed');
        }

        // One event per file set
        const filesChanged = events
          .map(event => ({ file: path.toPosix(event.path), action: event.type }))
          .filter(event => this.#isValidFile(event.file));

        if (filesChanged.length) {
          EventUtil.sendEvent('file', { time: Date.now(), files: filesChanged });
        }

        if (filesChanged.some(item => this.#state.isCompilerFile(item.file))) {
          throw new CompilerReset('Compiler has changed, restarting');
        }

        const items = filesChanged
          .map(event => this.#toCandidateEvent(event))
          .filter(event => this.#isValidEvent(event));

        if (items.length === 0) {
          return;
        }

        try {
          await this.#updateManifestWithEvents(items);
        } catch (manifestError) {
          log.info('Restarting due to manifest rebuild failure', manifestError);
          throw new CompilerReset(`Manifest rebuild failure: ${manifestError} `);
        }

        for (const item of items) {
          this.#queue.add(item);
        }
      } catch (out) {
        if (out instanceof Error && out.message.includes('Events were dropped by the FSEvents client.')) {
          out = new CompilerReset('FSEvents failure, requires restart');
        }
        return this.#queue.throw(out instanceof Error ? out : new Error(`${out} `));
      }
    }, { ignore });

    this.#cleanup.workspace = (): Promise<void> => listener.unsubscribe();
  }

  async #listenToolFolder(): Promise<void> {
    const build = this.#state.manifest.build;
    const toolRootFolder = path.dirname(path.resolve(this.#root, build.outputFolder));
    const toolFolders = new Set([toolRootFolder, build.typesFolder, build.outputFolder]
      .map(folder => path.resolve(this.#root, folder)));

    log.debug('Tooling Folders', [...toolFolders].map(folder => folder.replace(`${this.#root}/`, '')));

    await this.#cleanup.tool?.();

    const listener = watch(toolRootFolder, { encoding: 'utf8' }, async (event, file) => {
      if (!file) {
        return;
      }
      const full = path.resolve(toolRootFolder, file);
      const stat = await fs.stat(full).catch(() => null);
      if (toolFolders.has(full) && !stat) {
        this.#queue.throw(new CompilerReset(`Tooling folder removal ${full}`));
      }
    });
    this.#cleanup.tool = (): void => listener.close();
  }

  async #listenCanary(): Promise<void> {
    await this.#cleanup.canary?.();
    const full = path.resolve(this.#root, this.#watchCanary);
    await ManifestFileUtil.bufferedFileWrite(full, '');

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

  async #listenGitChanges(): Promise<void> {
    const gitFolder = path.resolve(this.#root, '.git');
    if (!await fs.stat(gitFolder).catch(() => false)) { return; }
    log.debug('Starting git canary');
    const listener = watch(gitFolder, { encoding: 'utf8' }, async (event, file) => {
      if (!file) {
        return;
      }
      if (file === 'HEAD') {
        this.#queue.throw(new CompilerReset('Git branch change detected'));
      }
    });
    this.#cleanup.git = (): void => listener.close();
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