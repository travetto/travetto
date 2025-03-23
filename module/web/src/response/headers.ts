export class HttpHeaders<V = string | string[]> {

  headers: Record<string, V> = {};
  headerNames: Record<string, string> = {};

  getHeaderNames(): string[] {
    return [...Object.keys(this.headers)];
  }

  setHeader(key: string, value: V): void {
    const lk = key.toLowerCase();
    const fk = this.headerNames[lk] ??= key;
    this.headers[fk] = value;
  }

  getHeader(key: string): V | undefined {
    return this.headers[this.headerNames[key.toLowerCase()]];
  }

  removeHeader(key: string): void {
    const lk = key.toLowerCase();
    if (lk in this.headerNames) {
      const fk = this.headerNames[lk];
      delete this.headers[fk];
      delete this.headerNames[lk];
    }
  }

  toObject(): Record<string, V> {
    return Object.freeze(this.headers);
  }

  toMap(): Map<string, V> {
    return new Map(Object.entries(this.headers));
  }
}
