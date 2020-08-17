export type CommonConfig = {
  workspace: string;
  active?: boolean;
};

export type PackOperation<T extends CommonConfig, K extends string = string> = {
  key: K;
  title: string;
  flags: [cli: string, description: string, test: undefined | ((inp: string) => boolean), prop: (keyof T)][];
  extend(a: T, b: Partial<T>): T;
  context?(cfg: T): Promise<string>;
  exec(cfg: T): AsyncGenerator<string>;
};