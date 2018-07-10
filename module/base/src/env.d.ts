export declare const AppEnv: {
  prod: boolean;
  dev: boolean;
  test: boolean;
  watch: boolean;
  docker: boolean;
  debug: boolean;
  trace: boolean;
  cwd: string;

  error: (...args: any[]) => void;

  is: (p: string) => boolean;
  profiles: string[];
}