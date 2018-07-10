export declare const Env: {
  prod: boolean;
  dev: boolean;
  test: boolean;
  watch: boolean;
  docker: boolean;
  debug: boolean;
  trace: boolean;
  cwd: string;
  frameworkDev: boolean;

  error: (...args: any[]) => void;

  is: (p: string) => boolean;
  profiles: string[];
}