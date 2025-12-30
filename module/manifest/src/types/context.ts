import type { NodePackageManager } from './common.ts';

export type ManifestContext = {
  workspace: {
    /** Workspace path for module */
    path: string;
    /** The module name for the workspace root */
    name: string;
    /** Is the workspace a monorepo? */
    mono?: boolean;
    /** The package manager of the workspace */
    manager: NodePackageManager;
    /** The default env name */
    defaultEnv: string;
  };
  build: {
    /** Compiler folder, relative to workspace */
    compilerFolder: string;
    /** Compiler module folder */
    compilerModuleFolder: string;
    /** URL for the compiler server */
    compilerUrl: string;
    /** Code output folder, relative to workspace */
    outputFolder: string;
    /** Location of development-time tool output */
    toolFolder: string;
    /** Location for type outputs */
    typesFolder: string;
  };
  main: {
    /** Main module for manifest */
    name: string;
    /** Folder, relative to workspace for main module */
    folder: string;
    /** Description of the main module */
    description?: string;
    /** Version of the main module */
    version: string;
  };
};