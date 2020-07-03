# Koa REST Source
## Koa provider for the travetto rest module.

**Install: @travetto/rest-koa**
```bash
npm install @travetto/rest-koa
```

The module is an [koa](https://koajs.com/) provider for the [RESTful API](https://github.com/travetto/travetto/tree/1.0.0-dev/module/rest "Declarative api for RESTful APIs with support for the dependency injection module.") module.  This module provides an implementation of [RestServer](https://github.com/travetto/travetto/tree/1.0.0-dev/module/rest/src/server/server.ts#L16) for automatic injection in the default Rest server.

## Customizing Rest App

**Code: Customizing the Koa App**
```typescript
import { Injectable } from '@travetto/di';
import { KoaRestServer } from '@travetto/rest-koa';

declare let rateLimit: any;

@Injectable({ primary: true })
class CustomRestServer extends KoaRestServer {
  createRaw() {
    const app = super.createRaw();
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });

    //  apply to all requests
    app.use(limiter);

    return app;
  }
}
```

## Default Middleware
When working with an [koa](https://koajs.com/) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

**Code: Configured Middleware**
```typescript
const app = new koa();
    app.use(kCompress());
    app.use(kBodyParser());
```

