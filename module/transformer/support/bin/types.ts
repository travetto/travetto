export type ModuleFileType = 'd.ts' | 'ts' | 'js' | 'json' | 'unknown';

export type ModuleFile = [string, ModuleFileType, number];

export type ModuleShape = {
  name: string;
  source: string;
  output: string;
  files: Record<string, ModuleFile[]>;
};

export type ManifestShape = {
  generated: number;
  modules: Record<string, ModuleShape>;
};
