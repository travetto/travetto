import fs from 'fs/promises';

import { IndexedModule, ManifestContext, ManifestModuleUtil, RootIndex, path } from '@travetto/manifest';

import { AsyncQueue } from '../../support/queue';

export type WatchEvent<T = {}> =
  ({ action: 'create' | 'update' | 'delete', file: string, folder: string } & T) |
  { action: 'reset', file: string };

const CREATE_THRESHOLD = 50;
const VALID_TYPES = new Set(['ts', 'typings', 'js', 'package-json']);

/** Watch file for reset */
async function watchForReset(q: AsyncQueue<WatchEvent>, root: string, files: string[], events: WatchEvent['action'][], signal: AbortSignal): Promise<void> {
  const fileSet = new Set(files);
  const eventSet = new Set(events);
  for await (const ev of fs.watch(root, { persistent: true, encoding: 'utf8', signal })) {
    if (fileSet.has(ev.filename!)) {
      const stat = await fs.stat(path.resolve(root, ev.filename!)).catch(() => undefined);
      const action = !stat ? 'delete' : ((Date.now() - stat.ctimeMs) < CREATE_THRESHOLD) ? 'create' : 'update';
      if (eventSet.has(action)) {
        q.add({ action: 'reset', file: ev.filename! });
      }
    }
  }
}

/** Watch recursive files for a given folder */
async function watchFolder(q: AsyncQueue<WatchEvent>, src: string, target: string, signal: AbortSignal): Promise<void> {
  const lib = await import('@parcel/watcher');
  const ignore = ['node_modules', '**/.trv', ...(await fs.readdir(src)).filter(x => x.startsWith('.'))];

  const cleanup = await lib.subscribe(src, async (err, events) => {
    if (err) {
      console.error('Watch Error', err);
    }
    for (const ev of events) {
      const finalEv = { action: ev.type, file: path.toPosix(ev.path), folder: target };
      if (ev.type !== 'delete') {
        const stats = await fs.stat(finalEv.file);
        if ((Date.now() - stats.ctimeMs) < CREATE_THRESHOLD) {
          ev.type = 'create'; // Force create on newly stated files
        }
      }

      if (ev.type === 'delete' && finalEv.file === src) {
        return q.close();
      }

      const matches = !finalEv.file.includes('/.') && VALID_TYPES.has(ManifestModuleUtil.getFileType(finalEv.file));
      if (matches) {
        q.add(finalEv);
      }
    }
  }, { ignore });
  signal.addEventListener('abort', () => cleanup.unsubscribe());
}

/** Watch files */
export async function* fileWatchEvents(manifest: ManifestContext, modules: IndexedModule[], signal: AbortSignal): AsyncIterable<WatchEvent> {
  const q = new AsyncQueue<WatchEvent>(signal);

  for (const m of modules.filter(x => !manifest.monoRepo || x.sourcePath !== manifest.workspacePath)) {
    watchFolder(q, m.sourcePath, m.sourcePath, signal);
  }

  // Add monorepo folders
  if (manifest.monoRepo) {
    const mono = modules.find(x => x.sourcePath === manifest.workspacePath)!;
    for (const folder of Object.keys(mono.files)) {
      if (!folder.startsWith('$')) {
        watchFolder(q, path.resolve(mono.sourcePath, folder), mono.sourcePath, signal);
      }
    }
  }

  watchForReset(q, RootIndex.manifest.workspacePath,
    [RootIndex.manifest.outputFolder, RootIndex.manifest.compilerFolder, RootIndex.manifest.toolFolder],
    ['delete'],
    signal
  );

  watchForReset(q, RootIndex.manifest.workspacePath,
    ['package-lock.json', 'package.json'],
    ['delete', 'update', 'create'],
    signal
  );

  yield* q;
}