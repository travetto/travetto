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
Session mechanics are defined by two main components within the module.  The primary pieces are:
* [`Encoders`](./src/encoder)
* [`Stores`](./src/store)


By default, the module supplies the [`CookieEncoder`](./src/encoder/cookie.ts) and the [`MemoryStore`](./src/store/memory.ts) for default usage. The memory store is not intended for production, so an alternate store should be configured.  Currently the only other store provided is one that leverages the [`Model`](https://github.com/travetto/travetto/tree/master/module/model) module.  This allows you to leverage your model service to provide an easy mechanism for storage and retrieval. To use it, just register it as a SessionStore and you are good to go:

**Code: Model Store**
```typescript
export class AppConfig {
  @InjectableFactory()
  getStore(model: ModelStore): SessionStore {
    // This method notifies the framework that ModelStore is the desired backing for the SessionStore
    return model;
  }
}
```

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

### Building a Custom Store
Session stores represent the ability to store session information internal to the app (i.e. not exposed to the client). The module comes with a [`MemoryStore`](./src/store/memory.ts) by default, but is not intended for production.  The store will store and maintain session data in a hashmap, without proper eviction (hence memory leaks). A store is defined by it's ability to retrieve and store session data:

**Code: Store structure**
```typescript
export abstract class SessionStore {
  async validate(session: Session): Promise<boolean>;
  async create(data: any, maxAge: number): Promise<Session>;
  abstract load(id: string): Promise<Session | undefined>;
  abstract store(data: Session): Promise<void>;
  abstract destroy(session: Session): Promise<boolean>;
}
```

The primary functionality that needs to be provided is that of `load`, `store` and  `destroy`.  This is as simple as:

**Code: MemoryStore**
```typescript
@Injectable({ target: MemoryStore })
export class MemoryStore extends SessionStore {
  storage = new Map<string, string>();

  async load(id: string) {
    const res = this.storage.get(id);
    if (res) {
      try {
        return JSON.parse(res) as Session;
      } catch (err) {
        console.error('Unable to restore malformed session');
      }
    }
    return;
  }

  async store(session: Session<any>) {
    this.storage.set(session.id!, JSON.stringify(session)); // Break references, allow for GC
  }

  async destroy(session: Session) {
    return this.storage.delete(session.id!);
  }
}
```

The memory store is simple but illustrates the structure well.