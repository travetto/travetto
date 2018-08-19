travetto: Rest-Express
===
The module is an [`express`](https://expressjs.com) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module.

## Creating and Running an App
To run a REST server, you will need to construct an entry point using the `@Application` decorator, as well as define a valid [`RestAppProvider`](./src/types.ts) to provide initialization for the application.  This would look like:

```typescript
@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new ExpressAppProvider();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}
```

And using the pattern established in the [`Dependency Injection`](https://github.com/travetto/di) module, you would run your program using `npx travetto sample`.

## Default Stack
When working with [`express`](https://expressjs.com) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* ```compression()```
* ```cookieParser()```
* ```bodyParser.json()```
* ```bodyParser.urlencoded()```
* ```bodyParser.raw({ type: 'image/*' })```
* ```session(this.config.session)```