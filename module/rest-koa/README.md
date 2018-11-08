travetto: Rest-Koa
===

**Install: KOA Provider**
```bash
$ npm install @travetto/rest-koa
```

The module is a [`koa`](https://koajs.com/) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module. A valid configuration of [`RestAppProvider`](./src/types.ts) would look like:

**Code: Wiring up Koa Provider**
```typescript
export class SampleConfig {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestKoaAppProvider();
  }
}
```