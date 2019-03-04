travetto: Rest-Koa
===

**Install: KOA Provider**
```bash
$ npm install @travetto/rest-koa
```

The module is a [`koa`](https://koajs.com/) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module. A valid configuration of [`RestApp`](./src/types.ts) would look like:

**Code: Wiring up Koa Provider**
```typescript
export class SampleConfig {

  @InjectableFactory()
  static getProvider(): RestApp {
    return new KoaRestApp();
  }
}
```