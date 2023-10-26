import fs from 'fs/promises';

import { path } from '@travetto/manifest';

import { FileResourceConfig, FileResourceProvider } from './resource';

/**
 * Simple file-based resource query provider
 */
export class FileQueryProvider extends FileResourceProvider {
  static query(cfg: FileResourceConfig & { filter: (file: string) => boolean, hidden?: boolean, maxDepth?: number }): AsyncIterable<string> {
    return new FileQueryProvider(cfg).query(cfg.filter, cfg.hidden, cfg.maxDepth);
  }

  maxDepth = 1000;

  /**
   * Query using a simple predicate, looking for files recursively
   */
  async * query(filter: (file: string) => boolean, hidden = false, maxDepth = this.maxDepth): AsyncIterable<string> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const search = [...this.paths.map(x => [x, x, 0] as [string, string, number])];
    const seen = new Set();
    while (search.length) {
      const [folder, root, depth] = search.shift()!;
      for (const sub of await fs.readdir(folder).catch(() => [])) {
        if (sub === '.' || sub === '..' || (!hidden && sub.startsWith('.'))) {
          continue;
        }
        const resolved = path.resolve(folder, sub);
        const stats = await fs.stat(resolved);
        if (stats.isDirectory()) {
          if (depth + 1 < maxDepth) {
            search.push([resolved, root, depth + 1]);
          }
        } else {
          const rel = resolved.replace(`${root}/`, '');
          if (!seen.has(rel) && filter(rel)) {
            yield rel;
            seen.add(rel);
          }
        }
      }
    }
  }
}