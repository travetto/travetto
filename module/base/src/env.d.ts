export declare const AppEnv: {
  prod: boolean;
  dev: boolean;
  test: boolean;
  watch: boolean;
  all: string[];
  docker: boolean;
  debug: boolean;
  trace: boolean;
  cwd: string;
  error: (...args: any[]) => void;
  is: (env: string) => boolean;
}