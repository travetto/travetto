travetto: Net
===

**Install: primary**
```bash
$ npm install @travetto/net
```

Network utilities used by the framework. 

## HTTP Requests
The http request functionality exists to allow for simple usage of the `node` [`http`](https://nodejs.org/api/http.html) and [`https`](https://nodejs.org/api/http.html) modules.  This functionality exists, in lieu of alternatives, as a means to provide the smallest footprint  possible.  The logic itself is simple:

**Code: Structure of request commands**
```typescript
class HttpRequest {
  static async exec(opts: ExecArgs, payload?: any): Promise<string>;
  static async exec(opts: ExecArgs & { pipeTo: NodeJS.WritableStream }, payload?: any): Promise<http.IncomingMessage>;
  static async exec(opts: ExecArgs & { pipeTo?: NodeJS.WritableStream }, payload?: any): Promise<string | http.IncomingMessage>;
  static async execJSON<T, U = any>(opts: ExecArgs, payload?: U): Promise<T>;
}
```