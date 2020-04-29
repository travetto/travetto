declare module 'mime-match' {
  function Match(type: string): ((input: string) => boolean);
  function Match(type: string, target: string): boolean;
  function Match(type: string, target?: string): boolean | ((input: string) => boolean);
  export = Match;
}