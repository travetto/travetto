travetto: Rest-Fastify
===
The module is an [`fastify`]](https://www.fastify.io/) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module.

## Creating and Running an App
To run a REST server, you will need to construct an entry point using the `@Application` decorator, as well as define a valid [`RestAppProvider`](./src/types.ts) to provide initialization for the application.  This would look like:

```typescript
@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new FastifyAppProvider();
  }

constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
```

And using the pattern established in the [`Dependency Injection`](https://github.com/travetto/di) module, you would run your program using `npx travetto sample`.