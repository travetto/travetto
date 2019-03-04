travetto: Rest-Fastify
===

**Install: Fastify Provider**
```bash
$ npm install @travetto/rest-fastify
```

The module is an [`fastify`](https://www.fastify.io/) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module. A valid configuration of [`RestApp`](./src/types.ts) would look like:

**Code: Wiring up Fastify Provider**
```typescript
export class SampleConfig {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new FastifyRestApp();
  }
}
```

**NOTE** Fastify does not allow for redeclaring of routes at runtime and so is unable to be used in the live-reload portion of the development process. 