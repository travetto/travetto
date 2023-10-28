import fs from 'fs/promises';

import { path } from '@travetto/manifest';

import { FileResourceConfig, FileResourceProvider } from './resource';

/**
 * Simple file-based resource query provider
 */
export class FileQueryProvider extends FileResourceProvider {
  static query(cfg: FileResourceConfig & { filter: (file: string) => boolean, includeHidden?: boolean }): AsyncIterable<string> {
    return new FileQueryProvider(cfg).query(cfg.filter, cfg.includeHidden);
  }

  /**
   * Query using a simple predicate, looking for files recursively
   */
  async * query(filter: (file: string) => boolean, includeHidden = false): AsyncIterable<string> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const search = [...this.paths.map(x => [x, x, 0] as [string, string, number])];
    const seen = new Set();
    while (search.length) {
      const [folder, root, depth] = search.shift()!;
      for (const sub of await fs.readdir(folder).catch(() => [])) {
        if (sub === '.' || sub === '..' || (!includeHidden && sub.startsWith('.'))) {
          continue;
        }
        const resolved = path.resolve(folder, sub);
        const stats = await fs.stat(resolved);
        if (stats.isDirectory()) {
          search.push([resolved, root, depth + 1]);
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