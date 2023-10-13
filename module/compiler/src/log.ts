import fs from 'fs';
import util from 'util';

import { RootIndex, WatchEvent, path } from '@travetto/manifest';

import type { CompilerLogEvent } from '../support/log';

const COMPILE_LOG = path.resolve(RootIndex.manifest.toolFolder, 'events.ndjson');

function log(level: 'info' | 'debug', message: string, ...args: unknown[]): void {
  if (process.send) {
    const ev: CompilerLogEvent = [level, util.format(message, ...args)];
    process.send(ev);
  } else {
    // eslint-disable-next-line no-console
    console[level](message, ...args);
  }
}

export const Log = {
  debug: log.bind(null, 'debug'),
  info: log.bind(null, 'info'),
  watchEvent: (ev: WatchEvent & { output: string }): void => fs.appendFileSync(COMPILE_LOG, `${JSON.stringify(ev)}\n`, { encoding: 'utf8' })
};