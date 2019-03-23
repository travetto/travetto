travetto: Rest-Express
===

**Install: Express Provider**
```bash
$ npm install @travetto/rest-express
```

The module is an [`express`](https://expressjs.com/) implementation of a [`RestApp`](https://github.com/travetto/travetto/tree/master/module/rest). A valid customization of the [`RestApp`](./src/app.ts) would look like:


**Code: Customizing an Express App**
```typescript
export class SampleConfig {

 @InjectableFactory()
  static customizer(): RestAppCustomizer<express.Application> {
return new (class extends RestAppCustomizer<express.Application> {
      customize(raw: express.Application) {
        raw.use(session({
          secret: 'keyboard cat',
          resave: false,
          saveUninitialized: true,
          cookie: {
            secure: false,
            httpOnly: true,
            expires: new Date(Date.now() + 1000 * 60 * 30)
          }
        }));
      }
    })();
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