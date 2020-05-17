travetto: Rest-Koa
===

**Install: KOA Provider**
```bash
$ npm install @travetto/rest-koa
```

The module is a [`koa`](https://koajs.com/) implementation of a [`RestServer`](https://github.com/travetto/travetto/tree/master/module/rest). A valid customization of the [`RestServer`](./src/server.ts) would look like:

**Code: Customizing a Koa App**
```typescript
export class SampleConfig {

 @InjectableFactory()
  static customizer(): RestServerCustomizer<koa> {
    return new (class extends RestServerCustomizer<koa> {
      customize(raw: koa) {
        raw.use(koaBunyanLogger());
    })();
  }
}
```

## Default Stack
When working with [`koa`](https://koajs.com/) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* `kCompress()`
* `kBodyParser()`