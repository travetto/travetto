export interface Class<T = any> {
  new(...args: any[]): T;
  __filename?: string;
  __id?: string;
}
