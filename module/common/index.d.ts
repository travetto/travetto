export namespace Manifest {
  export type ModuleFileType = 'd.ts' | 'ts' | 'js' | 'json' | 'unknown' | 'fixture';

  export type ModuleFile = [string, ModuleFileType, number];

  export type Module<T = Record<string, ModuleFile[]>> = {
    id: string;
    name: string;
    main?: boolean;
    local?: boolean;
    version: string,
    source: string;
    output: string;
    profiles: string[];
    files: T;
  };

  export type Root = {
    generated: number;
    buildLocation: string;
    main: string;
    modules: Record<string, Module>;
  };

  export type DeltaEvent = [string, 'added' | 'changed' | 'removed' | 'missing' | 'dirty'];

  export type Delta = Record<string, DeltaEvent[]>;

  export type State = {
    manifest: Root;
    delta: Delta;
  };
}

export type Package = {
  name: string;
  version: string;
  description?: string;
  license?: string;
  repository?: {
    url: string;
    directory?: string;
  };
  author?: {
    email?: string;
    name?: string;
  };
  main: string;
  homepage?: string;
  files?: string[];
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  keywords?: string[];

  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  optionalDependencies?: Record<string, string>;
  travetto?: {
    id?: string;
    displayName?: string;
    profileInherit?: boolean;
    profiles?: string[];
  },
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

export const path: {
  toPosix: (file: string) => string,
  delimiter: string;
  cwd: () => string,
  extname: (file: string) => string,
  basename: (file: string) => string,
  dirname: (file: string) => string,
  resolve: (...args: string[]) => string,
  join: (root: string, ...args: string[]) => string,
};

type SpawnCfg = { args?: string[], cwd?: string, failOnError?: boolean, env?: Record<string, string>, showWaitingMessage?: boolean };

export var spawn: (action: string, cmd: string, cfg?: SpawnCfg) => Promise<void>;
export var waiting: (message: string, work: () => Promise<void>) => Promise<void>;
