export declare const Env: {
  prod: boolean;
  dev: boolean;
  watch: boolean;
  docker: boolean;
  debug: boolean;
  trace: boolean;
  quietInit: boolean;
  cwd: string;
  isApp: boolean;
  appRoot: string | undefined;
  frameworkDev: boolean;
  profiles: string[];


  error(...args: any[]): void;
  hasProfile(p: string): boolean;
  isTrue(key: string): boolean;
  isFalse(key: string): boolean;
  get(key: string, def: string): string;
  get(key: string): string | undefined;
  getInt(key: string, def: number): number;
  getList(key: string): string[];
}

export declare const showEnv: () => void;