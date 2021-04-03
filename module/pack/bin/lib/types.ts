export type CommonConfig = {
  name?: string;
  file?: string;
  workspace: string;
  active?: boolean;
  postProcess?: { [key: string]: (<T extends CommonConfig>(cfg: T) => Promise<void>) }[];
  preProcess?: { [key: string]: (<T extends CommonConfig>(cfg: T) => Promise<void>) }[];
};

export type PackOperation<T extends CommonConfig> = {
  key: string;
  title: string;
  extend(a: T, b: Partial<T>): T;
  context(cfg: T): Promise<string> | string;
  exec(cfg: T): AsyncGenerator<string>;
};