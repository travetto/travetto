travetto: Rest-Session
===

**Install: session support**
```bash
$ npm install @travetto/rest-session
```

This is a module that adds session support to the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) framework.  Sessions are represented as:

**Code: Session Structure**
```typescript
export interface Session<T = any> {
  expiresAt: number | undefined;
  action?: 'create' | 'destroy' | 'modify';
  maxAge?: number;
  signature?: string;
  issuedAt: number;
  data: T;
}
```

A session allows for defining the expiration time, what state the session should be in, as well as the payload (session data).  The session and session data are accessible via the `@Context` parameter as `Session` and `SessionData` respectively.  Iit can also be accessed via the `request` as a session property. 

**Code: Sample Session Usage**
```typescript
@Put('/info')
async storeInfo(@Context() data: SessionData) {
  data.age = 20;
  data.name = 'Roger';; // Setting data
}
...
@Get('/logout')
async logout(@Context() session: Session) {
  await session.destroy();
}
...
@Get('/info/age')
async getInfo(@Context() data: SessionData) {
  return data.age;
}
```

This usage should be comparable to express, koa and mostly every other framework.

## Configuration
Session mechanics are defined by two main components, encoders and a cache store.  The encoders are provided within the module, but the stores are provided via the [`Cache`](https://github.com/travetto/travetto/tree/master/module/cache) module.  

By default, the module supplies the [`CookieEncoder`](./src/encoder/cookie.ts) and the [`MemoryCacheStore`] as default usage. 

### Building an Encoder
Encoders are pieces that enable you read/write the session state from the request/response.  This allows for sessions to be read/written to cookies, headers, url parameters, etc. The structure for the encoder is fairly straightforward:

**Code: Encoder structure**
```typescript
export abstract class SessionEncoder {
  abstract encode(req: Request, res: Response, session: Session | null): Promise<void>;
  abstract decode(req: Request): Promise<string | Session | undefined>;
}
```

The encoder will `encode` the session into the response, as a string.  The `decode` operation will then read that string and either produce a session identifier (a string) or a fully defined `Session` object.  This allows for storing the session data externally or internal to the app, and referencing it by a session identifier.

**Code: Header Encoder**
```typescript
@Injectable({ target: HeaderEncoder })
export class HeaderEncoder extends SessionEncoder {
  async encode(req: Request, res: Response, session: Session<any> | null): Promise<void> {
    if (session) {
      res.setHeader('sessionId', session.id!);
    }
    return;
  }

async decode(req: Request): Promise<string | Session | undefined> {
    return req.header('sessionId');
  }
}
```