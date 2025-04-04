import type { ManifestModuleFileType, ManifestModuleFolderType, ManifestModuleRole } from './common.ts';
import type { ManifestContext } from './context.ts';
import { Package } from './package.ts';

export type ManifestModuleFile =
  [path: string, type: ManifestModuleFileType, updated: number] |
  [path: string, type: ManifestModuleFileType, updated: number, role: ManifestModuleRole];

export type ManifestDepCore = {
  /** Package name */
  name: string;
  /** Package version */
  version: string;
  /** Is this the main module */
  main?: boolean;
  /** Is this a module that is part of the workspace */
  workspace?: boolean;
  /** Should this module be deployed to prod? */
  prod: boolean;
  /** Is the module intended to be published? */
  internal?: boolean;
};

export type ManifestModuleCore = ManifestDepCore & {
  sourceFolder: string;
  outputFolder: string;
  roles: ManifestModuleRole[];
  parents: string[];
};

export type ManifestModule = ManifestModuleCore & {
  files: Partial<Record<ManifestModuleFolderType, ManifestModuleFile[]>>;
};

export type ManifestRoot = ManifestContext & {
  generated: number;
  modules: Record<string, ManifestModule>;
};

export type FindConfig = {
  folder?: (folder: ManifestModuleFolderType) => boolean;
  module?: (module: IndexedModule) => boolean;
  file?: (file: IndexedFile) => boolean;
  sourceOnly?: boolean;
};

export type IndexedFile = {
  id: string;
  import: string;
  module: string;
  sourceFile: string;
  outputFile: string;
  relativeFile: string;
  role: ManifestModuleRole;
  type: ManifestModuleFileType;
};

export type IndexedModule = ManifestModuleCore & {
  sourcePath: string;
  outputPath: string;
  files: Record<ManifestModuleFolderType, IndexedFile[]>;
  children: Set<string>;
};

/** Module dependency, used in dependency visiting */
export type PackageModule = Omit<ManifestModule, 'files' | 'parents' | 'roles'> & {
  state: {
    /** Role root? */
    roleRoot?: boolean;
    /** Travetto package info */
    travetto?: Package['travetto'];
    /** Prod dependencies */
    prodDeps: Set<string>;
    /** Set of parent package names */
    parentSet: Set<string>;
    /** Set of child package names */
    childSet: Set<string>;
    /** Defined roles for a given module */
    roleSet: Set<ManifestModuleRole>;
  };
};
