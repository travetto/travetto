travetto: Rest-Fastify
===

**Install: Fastify Provider**
```bash
$ npm install @travetto/rest-fastify
```

The module is a [`fastify`](https://www.fastify.io/) implementation of a [`RestApp`](https://github.com/travetto/travetto/tree/master/module/rest). A valid customization of the [`RestApp`](./src/app.ts) would look like:

**Code: Customizing a Fastify App**
```typescript
export class SampleConfig {

  @InjectableFactory()
  static customizer(): RestAppCustomizer<fastify.FastifyInstance> {
    return new (class extends RestAppCustomizer<fastify.FastifyInstance> {
      customize(raw: fastify.FastifyInstance) {
        raw.register(fastifyCaching, {
           privacy: fastifyCaching.privacy.NOCACHE,
        }, err => { if (err) throw err });
      }
    })();
  }
}
```

**NOTE** Fastify does not allow for redeclaring of routes at runtime and so is unable to be used in the live-reload portion of the development process. 

## Default Stack
When working with [`fastify`](https://www.fastify.io/) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* `fastify-compress`
* `fastify-formbody`
* `app.addContentTypeParser('multipart/form-data;')`