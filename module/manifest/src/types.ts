export type ModuleFileType = 'd.ts' | 'ts' | 'js' | 'json' | 'unknown';

export type ModuleFile = [string, ModuleFileType, number];

export type ModuleShape<T = Record<string, ModuleFile[]>> = {
  id: string;
  name: string;
  source: string;
  output: string;
  files: T;
};

export type ManifestShape = {
  generated: number;
  modules: Record<string, ModuleShape>;
};
