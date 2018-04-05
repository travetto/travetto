declare global {
  interface Function {
    __id: string;
    __filename: string;
    __hash: string;
    __methodHashes?: { [key: string]: any };
  }
}

export interface Class<T = any> {
  new(...args: any[]): T;
}