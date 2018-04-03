export interface CommonProcess {
  send?(message: any, sendHandle?: any): void;
  removeListener(name: string, f: Function): void;
  on(name: string, f: Function): void;
  removeAllListeners(name: string): void;
  kill(...args: any[]): void;
}
