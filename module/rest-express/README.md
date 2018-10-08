travetto: Rest-Express
===

The module is an [`express`](https://expressjs.com) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module. A valid configuration of [`RestAppProvider`](./src/types.ts) would look like:

```typescript
export class SampleConfig {
  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestExpressAppProvider();
  }
}
```

## Default Stack
When working with [`express`](https://expressjs.com) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* ```compression()```
* ```cookieParser()```
* ```bodyParser.json()```
* ```bodyParser.urlencoded()```
* ```bodyParser.raw({ type: 'image/*' })```
* ```session(this.config.session)```