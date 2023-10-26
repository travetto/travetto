import rl from 'readline/promises';
import { Readable } from 'stream';

import { RootIndex } from '@travetto/manifest';
import { ShutdownManager } from '../shutdown';

export type CompilerWatchEvent = {
  action: 'create' | 'update' | 'delete';
  file: string;
  folder: string;
  output: string;
  module: string;
  time: number;
};

export async function getCompilerInfo(): Promise<{ iteration: number, path: string, type: 'watch' | 'build' } | undefined> {
  const res = await fetch(`${RootIndex.manifest.compilerUrl}/info`).catch(err => ({ ok: false, json: () => undefined }));
  if (res.ok) {
    return res.json();
  }
}

export async function* fetchCompilerEvents<T>(type: string, signal: AbortSignal): AsyncIterable<T> {
  const info = await getCompilerInfo();
  if (!info) {
    return;
  }
  const { iteration } = info;
  for (; ;) {
    try {
      const stream = await fetch(`${RootIndex.manifest.compilerUrl}/event/${type}`, { signal });
      for await (const line of rl.createInterface(Readable.fromWeb(stream.body))) {
        if (line.trim().charAt(0) === '{') {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          yield JSON.parse(line) as T;
        }
      }
    } catch (err) { }

    if (signal?.aborted || (await getCompilerInfo())?.iteration !== iteration) { // If aborted, or server is not available or iteration is changed
      return;
    }
  }
}

/**
 * Listen to file changes
 * @param signal
 */
export async function* listenFileChanges(): AsyncIterable<CompilerWatchEvent> {
  const kill = new AbortController();
  ShutdownManager.onExitRequested(() => kill.abort());

  let info = await getCompilerInfo();
  while (info?.type !== 'watch') { // If we not are watching from the beginning, wait for the server to change
    await new Promise(r => setTimeout(r, 1000)); // Check once a second to see when the compiler comes up
    info = await getCompilerInfo();
    if (info) {
      return;
    }
  }

  for await (const ev of fetchCompilerEvents<CompilerWatchEvent>('change', kill.signal)) {
    yield ev;
  }
}
