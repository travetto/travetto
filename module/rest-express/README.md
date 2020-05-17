travetto: Rest-Express
===

**Install: Express Provider**
```bash
$ npm install @travetto/rest-express
```

The module is an [`express`](https://expressjs.com/) implementation of a [`RestServer`](https://github.com/travetto/travetto/tree/master/module/rest). A valid customization of the [`RestServer`](./src/server.ts) would look like:


**Code: Customizing an Express App**
```typescript
export class SampleConfig {

 @InjectableFactory()
  static customizer(): RestServerCustomizer<express.Application> {
    return new (class extends RestServerCustomizer<express.Application> {
      customize(raw: express.Application) {
        const limiter = rateLimit({
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100 // limit each IP to 100 requests per windowMs
        });
       
        //  apply to all requests
        raw.use(limiter);
      }
    })();
  }
}
```

## Default Stack
When working with [`express`](https://expressjs.com) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* ```compression()```
* ```bodyParser.json()```
* ```bodyParser.urlencoded()```
* ```bodyParser.raw({ type: 'image/*' })```