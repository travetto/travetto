export type RunConfig = {
  filter?: (line: string) => boolean;
  rewrite?: (text: string) => string;
  module?: string;
  env?: Record<string, string>;
  envName?: string;
  cwd?: string;
};

export type CodeProps = { title?: string, src: string | Function, language?: string, outline?: boolean, startRe?: RegExp, endRe?: RegExp };