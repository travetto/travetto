import { Watcher } from '@travetto/watch';

export function main() {
  const watcher = new Watcher('base/path/to/...')
    .on('all', ({ event, entry }) => {
      if (entry.file.endsWith('.config') || entry.file.endsWith('.config.json')) {
        console.log('File Event', { event, file: entry.file });
      }
    });

  setTimeout(() => watcher.close(), 1000);
}