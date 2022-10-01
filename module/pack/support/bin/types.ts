export type CommonConfig = {
  name?: string;
  file?: string;
  workspace: string;
  active?: boolean;
  postProcess?: { [key: string]: (<T extends CommonConfig>(cfg: T) => Promise<void>) }[];
  preProcess?: { [key: string]: (<T extends CommonConfig>(cfg: T) => Promise<void>) }[];
};

export type PackOperation<T extends CommonConfig, K extends string> = {
  key: K;
  title: string;
  defaults?: Partial<T>;
  overrides?: Partial<T>;
  extend?(src: Partial<T>, dest: Partial<T>): Partial<T>;
  context(cfg: T): Promise<string> | string;
  exec(cfg: T): AsyncGenerator<string>;
  buildConfig(configs: Partial<T>[]): T;
};