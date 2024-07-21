import path from 'node:path';

import { type FunctionMetadata, ManifestContext, RuntimeIndex } from '@travetto/manifest';

import { Env } from './env';
import { FileLoader } from './file-loader';

class $RuntimeResources extends FileLoader {
  #env: string;
  override get searchPaths(): readonly string[] {
    if (this.#env !== Env.TRV_RESOURCES.val) {
      this.#env = Env.TRV_RESOURCES.val!;
      this.computePaths(Env.resourcePaths);
    }
    return super.searchPaths;
  }
}

export const RuntimeResources = new $RuntimeResources(Env.resourcePaths)

const build = <T extends object, K extends keyof ManifestContext>(inp: T, props: K[]): T & Pick<ManifestContext, K> => {
  for (const prop of props) {
    Object.defineProperty(inp, prop, { configurable: false, get: () => RuntimeIndex.manifest[prop] });
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return inp as T & ManifestContext;
};


export const RuntimeContext = build({
  /**
   * Produce a workspace relative path
   * @param rel The relative path
   */
  workspaceRelative(...rel: string[]): string {
    return path.resolve(RuntimeIndex.manifest.workspace.path, ...rel);
  },
  /**
   * Strip off the workspace path from a file
   * @param full A full path
   */
  stripWorkspacePath(full: string): string {
    return full === RuntimeIndex.manifest.workspace.path ? '' : full.replace(`${RuntimeIndex.manifest.workspace.path}/`, '');
  },
  /**
   * Produce a workspace path for tooling, with '@' being replaced by node_module/name folder
   * @param rel The relative path
   */
  toolPath(...rel: string[]): string {
    rel = rel.flatMap(x => x === '@' ? ['node_modules', RuntimeIndex.manifest.main.name] : [x]);
    return path.resolve(RuntimeIndex.manifest.workspace.path, RuntimeIndex.manifest.build.toolFolder, ...rel);
  },
  /**
   * Are we running from a mono-root?
   */
  get monoRoot(): boolean {
    return !!RuntimeIndex.manifest.workspace.mono && !RuntimeIndex.manifest.main.folder;
  },
  /**
   * Describe a function
   */
  describeFunction(fn?: Function, live = true): FunctionMetadata | undefined {
    return live ?
      RuntimeIndex.getFunctionMetadata(fn) :
      RuntimeIndex.getFunctionMetadataFromClass(fn);
  },
}, ['main', 'workspace']);
