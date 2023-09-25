import rl from 'readline/promises';
import { Readable } from 'stream';

import { RootIndex } from '@travetto/manifest';

export async function getCompilerInfo(): Promise<{ iteration: number, path: string } | undefined> {
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
