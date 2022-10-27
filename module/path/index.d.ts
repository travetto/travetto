declare module "@travetto/path" {
  function cwd(): string;
  function dirname(root: string): string;
  function basename(file: string): string;
  function extname(file: string): string;
  function join(root: string, ...path: string[]): string;
  function resolve(...path: string[]): string;
  function toPosix(path: string): string;
  function relative(start: string, dest: string): string;
}