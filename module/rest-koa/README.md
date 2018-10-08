travetto: Rest-Koa
===
The module is a [`koa`](https://koajs.com/) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module. A valid configuration of [`RestAppProvider`](./src/types.ts) would look like:

```typescript
export class SampleConfig {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestKoaAppProvider();
  }
}
```