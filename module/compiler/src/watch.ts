import { execFile } from 'node:child_process';
import { watch } from 'node:fs';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';

import { ManifestModuleUtil, PackageUtil, path } from '@travetto/manifest';

import { CommonUtil } from './common.ts';
import { IpcLog as log } from './log.ts';
import { AsyncQueue } from './queue.ts';
import {
  CompilerReset,
  type CompilerWatchEvent,
  type CompilerWatcherOptions,
  type CompilerWatchRawEvent,
  type CompileStateEntry
} from './types.ts';

const executeFile = promisify(execFile);
const gitRevParse = async <K extends string>(command: string[], cwd: string, keys: K[]): Promise<Record<K, string> | undefined> => {
  try {
    const { stdout } = await executeFile('git', ['rev-parse', ...command], { cwd });
    const lines = stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length) {
      return Object.fromEntries(keys.map((key, index) => [key, lines[index]])) as Record<K, string>;
    }
  } catch {}
};

const CONFIGURATION_FILE_PATTERN =
  /(^|\/)(package\.json|tsconfig(\..{,30})?\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/;

type CompilerWatchEventCandidate = Omit<CompilerWatchEvent, 'entry'> & { entry?: CompileStateEntry };

/**
 * Watches the workspace, tooling folders, and git state to produce filtered file change events
 */
export class CompilerWatcher implements AsyncIterable<CompilerWatchEvent[]> {
  #options: CompilerWatcherOptions & { checkIfSourceChanged: (file: string) => boolean };
  #cleanup: Partial<Record<'tool' | 'workspace' | 'rotation' | 'git', () => void | Promise<void>>> = {};
  #lastWorkspaceEventTime = Date.now();
  #watchRotationFrequency = 30; // 30 seconds
  #root: string;
  #queue: AsyncQueue<CompilerWatchRawEvent>;

  constructor(options: CompilerWatcherOptions, signal: AbortSignal) {
    this.#options = { ...options, checkIfSourceChanged: options.checkIfSourceChanged ?? (() => false) };
    this.#root = options.root;
    this.#queue = new AsyncQueue(signal);
    signal.addEventListener('abort', () =>
      Object.values(this.#cleanup).forEach(fn => {
        fn?.();
      })
    );
  }

  async #getWatchIgnores(): Promise<string[]> {
    const pkg = PackageUtil.readPackage(this.#root);
    const patterns = [...(pkg?.travetto?.build?.watchIgnores ?? []), '**/node_modules', '**/.*/'];
    const ignores = new Set(['node_modules', '.git', this.#options.outputFolder, this.#options.typesFolder]);
    for (const item of patterns) {
      if (item.includes('*')) {
        for await (const sub of fs.glob(item, { cwd: this.#root, exclude: ['**/node_modules/**', '**/.*/**'] })) {
          ignores.add(sub);
        }
      } else {
        ignores.add(item);
      }
    }
    return [...ignores].toSorted().map(ignore => (ignore.endsWith('/') ? ignore : `${ignore}/`));
  }

  #toCandidateEvent({ action, file }: CompilerWatchRawEvent): CompilerWatchEventCandidate {
    let entry = this.#options.getBySource?.(file);
    if (!entry && action !== 'delete') {
      entry = this.#options.registerArbitraryFile?.(file);
      if (entry) {
        action = 'create';
      }
    }

    return { entry, file: entry?.sourceFile ?? file, action, moduleFile: entry?.moduleFile ?? '' };
  }

  #isValidFile(file: string): boolean {
    if (file.includes('/.')) {
      return false;
    } else if (!ManifestModuleUtil.isSourceType(file) && !CONFIGURATION_FILE_PATTERN.test(file)) {
      return false;
    }
    return true;
  }

  #isValidEvent(event: CompilerWatchEventCandidate): event is CompilerWatchEvent {
    if (!event.entry) {
      log.debug(`Skipping unknown file ${event.file}`);
      return false;
    } else if ((event.action === 'update' || event.action === 'create') && !this.#options.checkIfSourceChanged(event.entry.sourceFile)) {
      const relativeFile = event.file.replace(`${this.#root}/`, '');
      log.debug(`Skipping ${event.action}, as contents unchanged ${relativeFile}`);
      return false;
    }
    return true;
  }

  async #listenWorkspace(): Promise<void> {
    const prevCleanup = this.#cleanup.workspace;
    const ignores = await this.#getWatchIgnores();

    log.debug('Starting workspace watcher', { root: this.#root });
    this.#lastWorkspaceEventTime = Date.now();

    const { subscribe } = await import('@parcel/watcher');
    const listener = await subscribe(
      this.#root,
      (error, events) => {
        this.#lastWorkspaceEventTime = Date.now();
        if (error) {
          if (Error.isError(error) && error.message.includes('must be re-scanned')) {
            this.#queue.throw(new CompilerReset('File system must be re-scanned'));
          } else {
            this.#queue.throw(error);
          }
        } else {
          for (const event of events) {
            const file = path.toPosix(event.path);
            if (this.#isValidFile(file)) {
              this.#queue.add({ action: event.type, file });
            }
          }
        }
      },
      { ignore: ignores }
    );

    const packageJsonFile = path.resolve(this.#root, 'package.json');
    const pkgListener = watch(packageJsonFile, { encoding: 'utf8' }, () => {
      this.#lastWorkspaceEventTime = Date.now();
      this.#queue.add({ action: 'update', file: packageJsonFile });
    });

    this.#cleanup.workspace = async (): Promise<void> => {
      pkgListener.close();
      await listener.unsubscribe();
    };

    await prevCleanup?.();
  }

  async #listenToolFolder(): Promise<void> {
    const toolRootFolder = path.dirname(path.resolve(this.#root, this.#options.outputFolder));
    const toolFolders = new Set(
      [toolRootFolder, this.#options.typesFolder, this.#options.outputFolder].map(folder => path.resolve(this.#root, folder))
    );

    log.debug(
      'Tooling Folders',
      [...toolFolders].map(folder => folder.replace(`${this.#root}/`, ''))
    );

    await this.#cleanup.tool?.();
    await fs.mkdir(toolRootFolder, { recursive: true });

    const listener = watch(toolRootFolder, { encoding: 'utf8' }, async (event, file) => {
      if (!file) {
        return;
      }
      const full = path.resolve(toolRootFolder, file);
      const stat = await fs.stat(full, { throwIfNoEntry: false });
      if (toolFolders.has(full) && !stat) {
        this.#queue.throw(new CompilerReset('Tooling folder removed', { files: [path.relative(this.#root, full)] }));
      }
    });
    this.#cleanup.tool = (): void => listener.close();
  }

  async #listenWorkspaceRotation(): Promise<void> {
    await this.#cleanup.rotation?.();

    const intervalId = setInterval(async () => {
      const idleTimeSeconds = Math.trunc((Date.now() - this.#lastWorkspaceEventTime) / 1000);
      if (idleTimeSeconds >= this.#watchRotationFrequency) {
        log.debug('Rotating parcel watcher subscription after idle period');
        try {
          await this.#listenWorkspace();
        } catch (error) {
          log.warn('Failed to rotate parcel subscription', error);
        }
      }
    }, this.#watchRotationFrequency * 1000);

    this.#cleanup.rotation = (): void => clearInterval(intervalId);
  }

  async #listenGitChanges(): Promise<void> {
    const directories = await gitRevParse(['--git-dir', '--git-common-dir'], this.#root, ['gitDirectory', 'commonDirectory']);
    if (!directories) {
      return;
    }
    const { gitDirectory, commonDirectory } = directories;

    log.debug('Starting git canary in', gitDirectory);
    let currentHead = await gitRevParse(['HEAD'], this.#root, ['hash']);
    let isChecking: Promise<void> | undefined;

    const checkChange = async (): Promise<void> => {
      try {
        await CommonUtil.nonBlockingTimeout(50);
        const nextHead = await gitRevParse(['HEAD'], this.#root, ['hash']);
        if (nextHead && (!currentHead || nextHead.hash !== currentHead.hash)) {
          const from = currentHead ? currentHead.hash : 'empty';
          const to = nextHead.hash;
          currentHead = nextHead;
          this.#queue.throw(new CompilerReset(`Git branch or commit change detected: ${from}=>${to}`, { soft: true }));
        }
      } finally {
        isChecking = undefined;
      }
    };

    const watchers: { close(): void }[] = [];
    const targets = [
      {
        folder: path.resolve(this.#root, gitDirectory),
        filter: (file?: string | null): boolean => !file || /^(HEAD|packed-refs|refs|logs\/HEAD)/.test(path.toPosix(file)),
        recursive: false
      },
      { folder: path.resolve(this.#root, commonDirectory, 'refs', 'heads'), filter: (): boolean => true, recursive: true }
    ];

    for (const { folder, filter, recursive } of targets) {
      if (await fs.stat(folder, { throwIfNoEntry: false })) {
        try {
          watchers.push(watch(folder, { encoding: 'utf8', recursive }, (_, file) => filter(file) && (isChecking ??= checkChange())));
        } catch {
          watchers.push(watch(folder, { encoding: 'utf8' }, (_, file) => filter(file) && (isChecking ??= checkChange())));
        }
      }
    }

    this.#cleanup.git = (): void => {
      watchers.forEach(watcher => watcher.close());
    };
  }

  /**
   * Validate reset triggers, collapse redundant pairs, and resolve watch events
   */
  prepareBatch(rawEvents: CompilerWatchRawEvent[]): CompilerWatchEvent[] {
    const validEvents = rawEvents.filter(item => !item.file.includes('/.'));

    const changedCompilerFiles = validEvents
      .filter(item => this.#options.isCompilerFile?.(item.file))
      .map(item => path.relative(this.#root, item.file));
    if (changedCompilerFiles.length) {
      throw new CompilerReset('Compiler source changed', { files: changedCompilerFiles });
    }

    const changedConfigurationFiles = validEvents
      .filter(item => CONFIGURATION_FILE_PATTERN.test(item.file))
      .map(item => path.relative(this.#root, item.file));
    if (changedConfigurationFiles.length) {
      throw new CompilerReset('Package or compiler configuration changed', { files: changedConfigurationFiles, soft: true });
    }

    const collapsed = new Map<string, CompilerWatchRawEvent>();
    for (const event of validEvents) {
      const prev = collapsed.get(event.file);
      if (prev?.action === 'create' && event.action === 'delete' && !this.#options.getBySource?.(event.file)) {
        collapsed.delete(event.file);
      } else {
        collapsed.set(event.file, prev?.action === 'delete' && event.action === 'create' ? { action: 'update', file: event.file } : event);
      }
    }

    return [...collapsed.values()].map(event => this.#toCandidateEvent(event)).filter(event => this.#isValidEvent(event));
  }

  /**
   * Start workspace, tooling, and git watchers idempotently
   */
  async start(): Promise<void> {
    if (!this.#cleanup.workspace) {
      await this.#listenWorkspace();
      await this.#listenWorkspaceRotation();
      await this.#listenToolFolder();
      await this.#listenGitChanges();
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<CompilerWatchEvent[]> {
    await this.start();

    for await (const firstEvent of this.#queue) {
      await CommonUtil.nonBlockingTimeout(25);
      const batch = [firstEvent, ...this.#queue.drain()];
      const prepared = this.prepareBatch(batch);
      if (prepared.length > 0) {
        yield prepared;
      }
    }
  }
}
