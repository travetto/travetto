import fs from 'fs/promises';

import { IndexedModule, ManifestContext, ManifestModuleUtil, RuntimeContext, path } from '@travetto/manifest';

import { AsyncQueue } from '../../support/queue';

export type WatchEvent<T = {}> =
  ({ action: 'create' | 'update' | 'delete', file: string, folder: string } & T) |
  { action: 'reset', file: string };

const CREATE_THRESHOLD = 50;
const VALID_TYPES = new Set(['ts', 'typings', 'js', 'package-json']);
type ToWatch = { file: string, actions: string[] };

/** Watch file for reset */
async function watchForReset(q: AsyncQueue<WatchEvent>, root: string, files: ToWatch[], signal: AbortSignal): Promise<void> {
  const watchers: Record<string, { folder: string, files: Map<string, (ToWatch & { name: string, actionSet: Set<string> })> }> = {};
  // Group by base path
  for (const el of files) {
    const full = path.resolve(root, el.file);
    const folder = path.dirname(full);
    const tgt = { ...el, name: path.basename(el.file), actionSet: new Set(el.actions) };
    const watcher = (watchers[folder] ??= { folder, files: new Map() });
    watcher.files.set(tgt.name, tgt);
  }

  // Fire them all off
  Object.values(watchers).map(async (watcher) => {
    for await (const ev of fs.watch(watcher.folder, { persistent: true, encoding: 'utf8', signal })) {
      const toWatch = watcher.files.get(ev.filename!);
      if (toWatch) {
        const stat = await fs.stat(path.resolve(root, ev.filename!)).catch(() => undefined);
        const action = !stat ? 'delete' : ((Date.now() - stat.ctimeMs) < CREATE_THRESHOLD) ? 'create' : 'update';
        if (toWatch.actionSet.has(action)) {
          q.add({ action: 'reset', file: ev.filename! });
        }
      }
    }
  });
}

/** Watch recursive files for a given folder */
async function watchFolder(ctx: ManifestContext, q: AsyncQueue<WatchEvent>, src: string, target: string, signal: AbortSignal): Promise<void> {
  const lib = await import('@parcel/watcher');
  const ignore = [
    'node_modules', '**/.trv',
    ...((!ctx.monoRepo || src === ctx.workspacePath) ? [ctx.compilerFolder, ctx.outputFolder, ctx.toolFolder] : []),
    ...(await fs.readdir(src)).filter(x => x.startsWith('.'))
  ];

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
    watchFolder(manifest, q, m.sourcePath, m.sourcePath, signal);
  }

  // Add monorepo folders
  if (manifest.monoRepo) {
    const mono = modules.find(x => x.sourcePath === manifest.workspacePath)!;
    for (const folder of Object.keys(mono.files)) {
      if (!folder.startsWith('$')) {
        watchFolder(manifest, q, path.resolve(mono.sourcePath, folder), mono.sourcePath, signal);
      }
    }
  }

  watchForReset(q, RuntimeContext.workspacePath, [
    { file: RuntimeContext.outputFolder, actions: ['delete'] },
    { file: RuntimeContext.compilerFolder, actions: ['delete'] },
    { file: RuntimeContext.toolFolder, actions: ['delete'] },
    { file: 'package-lock.json', actions: ['delete', 'update', 'create'] },
    { file: 'package.json', actions: ['delete', 'update', 'create'] }
  ], signal);

  yield* q;
}