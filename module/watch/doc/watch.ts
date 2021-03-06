import { Watcher } from '@travetto/watch';

export function main() {
  const watcher = new Watcher('base/path/to/...')
    .on('all', ev => {
      if (ev.entry.file.endsWith('.config') || ev.entry.file.endsWith('.config.json')) {
        console.log('File Event', { event: ev.event, file: ev.entry.file });
      }
    });

  setTimeout(() => watcher.close(), 1000);
}