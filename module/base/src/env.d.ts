export declare const Env: {
  prod: boolean;
  dev: boolean;
  test: boolean;
  e2e: boolean;
  watch: boolean;
  docker: boolean;
  debug: boolean;
  trace: boolean;
  cwd: string;
  frameworkDev: boolean;
  profiles: string[];

  error(...args: any[]): void;
  hasProfile(p: string): boolean;
  isTrue(key: string): boolean;
  isFalse(key: string): boolean;
  get(key: string, def: string): string;
  get(key: string): string | undefined;
  getList(key: string): string[];
}

export declare const showEnv: () => void;