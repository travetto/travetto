import path from 'node:path';

import { type ManifestContext, ManifestIndex } from '@travetto/manifest';
import { Env } from './env';
import { FileLoader } from './file-loader';

/** Runtime manifest index */
export const RuntimeIndex = new ManifestIndex();

/** Constrained version of {@type ManifestContext} */
export const RuntimeContext = {
  /** Manifest main */
  get main(): ManifestContext['main'] {
    return RuntimeIndex.manifest.main
  },

  /** Manifest workspace */
  get workspace(): ManifestContext['workspace'] {
    return RuntimeIndex.manifest.workspace
  },

  /** Are we running from a mono-root? */
  get monoRoot(): boolean {
    return !!RuntimeIndex.manifest.workspace.mono && !RuntimeIndex.manifest.main.folder;
  },

  /** Main source path */
  get mainSourcePath(): string {
    return RuntimeIndex.mainModule.sourcePath;
  },

  /** Produce a workspace relative path */
  workspaceRelative(...rel: string[]): string {
    return path.resolve(RuntimeIndex.manifest.workspace.path, ...rel);
  },

  /** Strip off the workspace path from a file */
  stripWorkspacePath(full: string): string {
    return full === RuntimeIndex.manifest.workspace.path ? '' : full.replace(`${RuntimeIndex.manifest.workspace.path}/`, '');
  },

  /** Produce a workspace path for tooling, with '@' being replaced by node_module/name folder */
  toolPath(...rel: string[]): string {
    rel = rel.flatMap(x => x === '@' ? ['node_modules', RuntimeIndex.manifest.main.name] : [x]);
    return path.resolve(RuntimeIndex.manifest.workspace.path, RuntimeIndex.manifest.build.toolFolder, ...rel);
  },

  /** Resolve module paths */
  modulePaths(paths: string[]): string[] {
    const overrides = Env.TRV_RESOURCE_OVERRIDES.object ?? {};
    return [...new Set(paths.map(x => RuntimeIndex.resolveModulePath(overrides[x] ?? x)))];
  },

  /** Resolve resource paths */
  resourcePaths(paths: string[] = []): string[] {
    return this.modulePaths([...paths, ...Env.TRV_RESOURCES.list ?? [], '@#resources', '@@#resources']);
  },

  /** Get env name, with support for the default env */
  get envName(): string | undefined {
    return Env.name || (!Env.production ? RuntimeIndex.manifest.workspace.defaultEnv : undefined);
  }
};

/**
 * Environment aware file loader
 */
class $RuntimeResources extends FileLoader {
  #computed: string[];
  #env: string;

  constructor() {
    super(RuntimeContext.resourcePaths());
  }

  override get searchPaths(): readonly string[] {
    if (this.#env !== Env.TRV_RESOURCES.val) {
      this.#env = Env.TRV_RESOURCES.val!;
      this.#computed = RuntimeContext.resourcePaths();
    }
    return this.#computed ?? super.searchPaths;
  }
}

/** Runtime resources */
export const RuntimeResources = new $RuntimeResources();