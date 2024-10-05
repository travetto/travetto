import fs from 'node:fs/promises';
import { watch } from 'node:fs';

import { ManifestFileUtil, ManifestModuleUtil, ManifestUtil, PackageUtil, path } from '@travetto/manifest';

import { CompilerReset, type CompilerWatchEvent, CompileStateEntry } from './types';
import { CompilerState } from './state';
import { CompilerUtil } from './util';

import { AsyncQueue } from '../support/queue';
import { IpcLogger } from '../support/log';

const log = new IpcLogger({ level: 'debug' });

type CompilerWatchEventCandidate = Omit<CompilerWatchEvent, 'entry'> & { entry?: CompileStateEntry };

export class CompilerWatcher extends AsyncQueue<CompilerWatchEvent> {

  static #ignoreCache: Record<string, string[]> = {};

  /** Get standard set of watch ignores */
  static async getWatchIgnores(root: string): Promise<string[]> {
    if (this.#ignoreCache[root]) {
      return this.#ignoreCache[root];
    }

    const pkg = PackageUtil.readPackage(root);
    const patterns = [
      ...pkg?.travetto?.build?.watchIgnores ?? [],
      '**/node_modules',
      '.*/**/node_modules'
    ];
    const ignores = new Set(['node_modules', '.git']);
    for (const item of patterns) {
      if (item.includes('*')) {
        for await (const sub of fs.glob(item, { cwd: root })) {
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
    this.#ignoreCache[root] = [...ignores].sort().map(x => x.endsWith('/') ? x : `${x}/`);
    return this.#ignoreCache[root];
  }

  #state: CompilerState;
  #cleanup: Partial<Record<'tool' | 'workspace' | 'canary', () => (void | Promise<void>)>> = {};
  #watchCanary: string = '.trv/canary.id';
  #lastWorkspaceModified = Date.now();
  #watchCanaryFreq = 5;

  constructor(state: CompilerState, signal: AbortSignal) {
    super(signal);
    this.#state = state;
    signal.addEventListener('abort', () => Object.values(this.#cleanup).forEach(x => x()));
  }

  #watchToInternal(action: CompilerWatchEvent['action'], file: string): CompilerWatchEventCandidate {
    let entry = this.#state.getBySource(file);
    const mod = entry?.module ?? this.#state.manifestIndex.findModuleForArbitraryFile(file);
    if (mod && action === 'create' && !entry) {
      const modRoot = mod.sourceFolder || this.#state.manifest.workspace.path;
      const moduleFile = file.includes(modRoot) ? file.split(`${modRoot}/`)[1] : file;
      entry = this.#state.registerInput(mod, moduleFile);
    }
    return { entry, file: entry?.sourceFile ?? file, action };
  }

  #filterInternal(ev: CompilerWatchEventCandidate): ev is CompilerWatchEvent {
    const relativeFile = ev.file.replace(`${this.#state.manifest.workspace.path}}/`, '');
    const fileType = ManifestModuleUtil.getFileType(relativeFile);

    if (relativeFile === this.#watchCanary) {
      return false;
    } else if (relativeFile.startsWith('.')) {
      return false;
    } else if (!CompilerUtil.validFile(fileType)) {
      return false;
    } else if (!ev.entry) {
      log.debug(`Skipping unknown file ${relativeFile}`);
      return false;
    } else if (ev.action === 'update' && !this.#state.checkIfSourceChanged(ev.entry.sourceFile)) {
      log.debug(`Skipping update, as contents unchanged ${relativeFile}`);
      return false;
    }
    return true;
  }

  async #reconcileAddRemove(compilerEvents: CompilerWatchEvent[]): Promise<void> {
    const nonUpdates = compilerEvents.filter(x => x.entry.outputFile && x.action !== 'update');
    if (!nonUpdates.length) {
      return;
    }

    for (const ev of nonUpdates) {
      if (ev.action === 'delete') {
        this.#state.removeSource(ev.entry.sourceFile);
      }
    }

    try {
      const mods = [...new Set(nonUpdates.map(v => v.entry.module.name))];

      const parents = new Map<string, string[]>(
        mods.map(m => [m, this.#state.manifestIndex.getDependentModules(m, 'parents').map(x => x.name)])
      );

      const moduleToFiles = new Map(
        [...mods, ...parents.values()].flat().map(m => [m, {
          context: ManifestUtil.getModuleContext(this.#state.manifest, this.#state.manifestIndex.getManifestModule(m)!.sourceFolder),
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          events: [] as CompilerWatchEvent[]
        }])
      );

      for (const ev of nonUpdates) {
        const modName = ev.entry.module.name;
        for (const parent of parents.get(modName)!) {
          const mod = moduleToFiles.get(parent);
          if (!mod || !mod.events) {
            throw new CompilerReset(`Unknown module ${modName}`);
          }
          mod.events.push(ev);
        }
      }

      for (const { context, events } of moduleToFiles.values()) {
        const newManifest = await ManifestUtil.buildManifest(context);
        for (const { action, file, entry } of events) {
          const mod = entry.module.name;
          const modRoot = entry.module.sourceFolder || this.#state.manifest.workspace.path;
          const moduleFile = file.includes(modRoot) ? file.split(`${modRoot}/`)[1] : file;
          const folderKey = ManifestModuleUtil.getFolderKey(moduleFile);
          const fileType = ManifestModuleUtil.getFileType(moduleFile);

          const modFiles = newManifest.modules[mod].files[folderKey] ??= [];
          const idx = modFiles.findIndex(x => x[0] === moduleFile);

          if (action === 'create' && idx < 0) {
            modFiles.push([moduleFile, fileType, Date.now()]);
          } else if (idx >= 0) {
            if (action === 'delete') {
              modFiles.splice(idx, 1);
            } else {
              modFiles[idx] = [moduleFile, fileType, Date.now()];
            }
          }
        }
        await ManifestUtil.writeManifest(newManifest);
      }

      this.#state.manifestIndex.init(ManifestUtil.getManifestLocation(this.#state.manifest));
    } catch (mErr) {
      log.info('Restarting due to manifest rebuild failure', mErr);
      if (!(mErr instanceof CompilerReset)) {
        throw new CompilerReset(`Manifest rebuild failure: ${mErr}`);
      } else {
        throw mErr;
      }
    }
  }

  /** Listen recursively for file changes */
  async #listenWorkspace(): Promise<void> {
    const root = this.#state.manifest.workspace.path;
    const lib = await import('@parcel/watcher');
    const ignore = await CompilerWatcher.getWatchIgnores(root);
    const packageFiles = new Set(['package-lock.json', 'yarn.lock', 'package.json'].map(x => path.resolve(root, x)));

    log.debug('Ignore Globs', await CompilerWatcher.getWatchIgnores(root));

    await this.#cleanup.workspace?.();

    const listener = await lib.subscribe(root, async (err, events) => {
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
          .map(x => this.#watchToInternal(x.type, path.toPosix(x.path)))
          .filter(x => this.#filterInternal(x));

        await this.#reconcileAddRemove(items);

        for (const item of items) {
          this.add(item);
        }
      } catch (out) {
        const finalErr = out instanceof Error ? out : new Error(`${out}`);
        return this.throw(finalErr);
      }
    }, { ignore });

    this.#cleanup.workspace = (): Promise<void> => listener.unsubscribe();
  }

  /** Listen for tool folder changes */
  async #listenToolFolder(): Promise<void> {
    const build = this.#state.manifest.build;
    const root = this.#state.manifest.workspace.path;
    const toolRootFolder = path.dirname(path.resolve(root, build.compilerFolder));
    const toolFolders = new Set([
      toolRootFolder, build.compilerFolder, build.typesFolder, build.outputFolder
    ].map(x => path.resolve(root, x)));

    log.debug('Tooling Folders', [...toolFolders].map(x => x.replace(`${root}/`, '')));

    await this.#cleanup.tool?.();

    const listener = watch(toolRootFolder, { encoding: 'utf8' }, async (ev, f) => {
      if (!f) {
        return;
      }
      const full = path.resolve(toolRootFolder, f);
      const stat = await fs.stat(full).catch(() => null);
      if (toolFolders.has(full) && !stat) {
        this.throw(new CompilerReset(`Tooling folder removal ${full}`));
      }
    });
    this.#cleanup.tool = (): void => listener.close();
  }

  /** Canary to ensure workspace doesn't stop responding */
  async #listenCanary(): Promise<void> {
    await this.#cleanup.canary?.();
    const full = path.resolve(this.#state.manifest.workspace.path, this.#watchCanary);
    await ManifestFileUtil.bufferedFileWrite(full, '');

    const canaryId = setInterval(async () => {
      const delta = Math.trunc((Date.now() - this.#lastWorkspaceModified) / 1000);
      if (delta > this.#watchCanaryFreq * 2) {
        this.throw(new CompilerReset(`Workspace watch stopped responding ${delta}s ago`));
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
    return super[Symbol.asyncIterator]();
  }
}