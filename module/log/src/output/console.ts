export interface ConsoleOutputOpts {

}
export function consoleOutput(opts: ConsoleOutputOpts) {
  return (msg: string) => {
    (console as any).log(msg);
  }
};