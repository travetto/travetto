declare global {
  interface Function {
    __id: string;
    __filename: string;
  }
}

export interface Class<T = any> {
  new(...args: any[]): T;
}