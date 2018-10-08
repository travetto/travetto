travetto: Rest-Fastify
===
The module is an [`fastify`](https://www.fastify.io/) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module. A valid configuration of [`RestAppProvider`](./src/types.ts) would look like:

```typescript
export class SampleConfig {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestFastifyAppProvider();
  }
}
```

**NOTE** Fastify does not allow for redeclaring of routes at runtime and so is unable to be used in the live-reload portion of the development process. 