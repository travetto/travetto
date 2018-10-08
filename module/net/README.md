travetto: Net
===

Network utilities used by the framework. 

## HTTP Requests
The http request functionality exists to allow for simple usage of the `node` [`http`](https://nodejs.org/api/http.html) and [`https`](https://nodejs.org/api/http.html) modules.  This functionality exists, in lieu of alternatives, as a means to provide the smallest footprint  possible.  The logic itself is simple:

```typescript
request(opts: http.RequestOptions & { url: string }, data?: any): Promise<string>;
request(opts: http.RequestOptions & { url: string, pipeTo: any }, data?: any): Promise<http.IncomingMessage>;
requestJSON<T, U>(opts: http.RequestOptions & { url: string }, data?: U): Promise<T>;
```