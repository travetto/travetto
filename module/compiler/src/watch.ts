import fs from 'node:fs/promises';
import { watch } from 'node:fs';

import { ManifestFileUtil, ManifestModuleUtil, ManifestRoot, ManifestUtil, PackageUtil, path } from '@travetto/manifest';

import { CompilerReset, type CompilerWatchEvent, type CompileStateEntry } from './types.ts';
import { CompilerState } from './state.ts';
import { CompilerUtil } from './util.ts';

import { AsyncQueue } from '../support/queue.ts';
import { IpcLogger } from '../support/log.ts';

const log = new IpcLogger({ level: 'debug' });

type CompilerWatchEventCandidate = Omit<CompilerWatchEvent, 'entry'> & { entry?: CompileStateEntry };

export class CompilerWatcher {
  #state: CompilerState;
  #cleanup: Partial<Record<'tool' | 'workspace' | 'canary', () => (void | Promise<void>)>> = {};
  #watchCanary: string = '.trv/canary.id';
  #lastWorkspaceModified = Date.now();
  #watchCanaryFreq = 5;
  #root: string;
  #q: AsyncQueue<CompilerWatchEvent>;

  constructor(state: CompilerState, signal: AbortSignal) {
    this.#state = state;
    this.#root = state.manifest.workspace.path;
    this.#q = new AsyncQueue(signal);
    signal.addEventListener('abort', () => Object.values(this.#cleanup).forEach(x => x()));
  }

  async #getWatchIgnores(): Promise<string[]> {
    const pkg = PackageUtil.readPackage(this.#root);
    const patterns = [
      ...pkg?.travetto?.build?.watchIgnores ?? [],
      '**/node_modules',
      '.*/**/node_modules'
    ];
    const ignores = new Set(['node_modules', '.git']);
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
    return [...ignores].toSorted().map(x => x.endsWith('/') ? x : `${x}/`);
  }

  #toCandidateEvent(action: CompilerWatchEvent['action'], file: string): CompilerWatchEventCandidate {
    let entry = this.#state.getBySource(file);
    const mod = entry?.module ?? this.#state.manifestIndex.findModuleForArbitraryFile(file);
    if (mod && action === 'create' && !entry) {
      const modRoot = mod.sourceFolder || this.#root;
      const moduleFile = file.includes(`${modRoot}/`) ? file.split(`${modRoot}/`)[1] : file;
      entry = this.#state.registerInput(mod, moduleFile);
    } else if (action === 'delete' && entry) {
      this.#state.removeSource(entry.sourceFile); // Ensure we remove it
    }
    return { entry, file: entry?.sourceFile ?? file, action };
  }

  #isValidEvent(ev: CompilerWatchEventCandidate): ev is CompilerWatchEvent {
    const relativeFile = ev.file.replace(`${this.#root}/`, '');
    if (relativeFile === this.#watchCanary) {
      return false;
    } else if (relativeFile.startsWith('.')) {
      return false;
    } else if (!ev.entry) {
      log.debug(`Skipping unknown file ${relativeFile}`);
      return false;
    } else if (ev.action === 'update' && !this.#state.checkIfSourceChanged(ev.entry.sourceFile)) {
      log.debug(`Skipping update, as contents unchanged ${relativeFile}`);
      return false;
    } else if (!CompilerUtil.validFile(ManifestModuleUtil.getFileType(relativeFile))) {
      return false;
    }
    return true;
  }

  #getManifestUpdateEventsByParents(events: CompilerWatchEvent[]): Map<string, CompilerWatchEvent[]> {
    const eventsByMod = new Map<string, CompilerWatchEvent[]>();
    for (const ev of events) {
      if (ev.action === 'update') {
        continue;
      }

      const mod = ev.entry.module;
      const moduleSet = new Set(this.#state.manifestIndex.getDependentModules(mod.name, 'parents').map(x => x.name));
      moduleSet.add(this.#state.manifest.workspace.name);
      for (const m of moduleSet) {
        if (!eventsByMod.has(m)) {
          eventsByMod.set(m, []);
        }
        eventsByMod.get(m)!.push(ev);
      }
    }
    return eventsByMod;
  }

  #updateManifestForEvent({ action, file, entry }: CompilerWatchEvent, manifest: ManifestRoot): void {
    if (action === 'update') {
      return;
    }

    const moduleName = entry.module.name;
    const moduleRoot = entry.module.sourceFolder || this.#root;
    const relativeFile = file.includes(moduleRoot) ? file.split(`${moduleRoot}/`)[1] : file;
    const folderKey = ManifestModuleUtil.getFolderKey(relativeFile);
    const fileType = ManifestModuleUtil.getFileType(relativeFile);

    const manifestModuleFiles = manifest.modules[moduleName].files[folderKey] ??= [];
    const idx = manifestModuleFiles.findIndex(x => x[0] === relativeFile);
    const wrappedIdx = idx < 0 ? manifestModuleFiles.length : idx;

    switch (action) {
      case 'create': manifestModuleFiles[wrappedIdx] = [relativeFile, fileType, Date.now()]; break;
      case 'delete': idx >= 0 && manifestModuleFiles.splice(idx, 1); break;
    }
  }

  async #reconcileManifestUpdates(compilerEvents: CompilerWatchEvent[]): Promise<void> {
    for (const [mod, events] of this.#getManifestUpdateEventsByParents(compilerEvents).entries()) {
      const moduleRoot = this.#state.manifestIndex.getManifestModule(mod)!.sourceFolder;
      const moduleContext = ManifestUtil.getModuleContext(this.#state.manifest, moduleRoot);
      const manifestLocation = ManifestUtil.getManifestLocation(moduleContext, mod);
      const moduleManifest = ManifestUtil.readManifestSync(manifestLocation);

      log.debug('Updating manifest', { module: mod, events: events.length });
      for (const ev of events) {
        this.#updateManifestForEvent(ev, moduleManifest);
      }
      await ManifestUtil.writeManifest(moduleManifest);
    }

    this.#state.manifestIndex.init(ManifestUtil.getManifestLocation(this.#state.manifest));
  }

  async #listenWorkspace(): Promise<void> {
    const lib = await import('@parcel/watcher');
    const ignore = await this.#getWatchIgnores();
    const packageFiles = new Set(['package-lock.json', 'yarn.lock', 'package.json'].map(x => path.resolve(this.#root, x)));

    log.debug('Ignore Globs', ignore);
    log.debug('Watching', this.#root);

    await this.#cleanup.workspace?.();

    const listener = await lib.subscribe(this.#root, async (err, events) => {
      this.#lastWorkspaceModified = Date.now();

      try {
        if (err) {
          throw err instanceof Error ? err : new Error(`${err}`);
        } else if (events.length > 25) {
          throw new CompilerReset(`Large influx of file changes: ${events.length}`);
        } else if (events.some(ev => packageFiles.has(path.toPosix(ev.path)))) {
          throw new CompilerReset('Package information changed');
        }

        const items = events
          .map(x => this.#toCandidateEvent(x.type, path.toPosix(x.path)))
          .filter(x => this.#isValidEvent(x));

        try {
          await this.#reconcileManifestUpdates(items);
        } catch (mErr) {
          log.info('Restarting due to manifest rebuild failure', mErr);
          throw new CompilerReset(`Manifest rebuild failure: ${mErr}`);
        }

        for (const item of items) {
          this.#q.add(item);
        }
      } catch (out) {
        if (out instanceof Error && out.message.includes('Events were dropped by the FSEvents client.')) {
          out = new CompilerReset('FSEvents failure, requires restart');
        }
        return this.#q.throw(out instanceof Error ? out : new Error(`${out}`));
      }
    }, { ignore });

    this.#cleanup.workspace = (): Promise<void> => listener.unsubscribe();
  }

  async #listenToolFolder(): Promise<void> {
    const build = this.#state.manifest.build;
    const toolRootFolder = path.dirname(path.resolve(this.#root, build.compilerFolder));
    const toolFolders = new Set([
      toolRootFolder, build.compilerFolder, build.typesFolder, build.outputFolder
    ].map(x => path.resolve(this.#root, x)));

    log.debug('Tooling Folders', [...toolFolders].map(x => x.replace(`${this.#root}/`, '')));

    await this.#cleanup.tool?.();

    const listener = watch(toolRootFolder, { encoding: 'utf8' }, async (ev, f) => {
      if (!f) {
        return;
      }
      const full = path.resolve(toolRootFolder, f);
      const stat = await fs.stat(full).catch(() => null);
      if (toolFolders.has(full) && !stat) {
        this.#q.throw(new CompilerReset(`Tooling folder removal ${full}`));
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
      } else if (delta > this.#watchCanaryFreq * 2) {
        this.#q.throw(new CompilerReset(`Workspace watch stopped responding ${delta}s ago`));
      } else if (delta > this.#watchCanaryFreq) {
        log.error('Restarting parcel due to inactivity');
        await this.#listenWorkspace();
      } else {
        await fs.utimes(full, new Date(), new Date());
      }
    }, this.#watchCanaryFreq * 1000);

    this.#cleanup.canary = (): void => clearInterval(canaryId);
  }

  [Symbol.asyncIterator](): AsyncIterator<CompilerWatchEvent> {
    if (!this.#cleanup.workspace) {
      this.#listenWorkspace();
      this.#listenToolFolder();
      this.#listenCanary();
    }
    return this.#q[Symbol.asyncIterator]();
  }
}