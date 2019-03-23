// import * as express from 'express';
// import * as session from 'express-session';

// import { InjectableFactory } from '@travetto/di';
// import { Application, RestApp, RestAppCustomizer } from '@travetto/rest';
// import { ExpressRestApp } from '@travetto/rest-express';

// @Application('sample:express')
// export class SampleApp {

//   @InjectableFactory()
//   static customizer(): RestAppCustomizer<express.Application> {
//     return new (class extends RestAppCustomizer<express.Application> {
//       customize(raw: express.Application) {
//         raw.use(session({
//           secret: 'keyboard cat',
//           resave: false,
//           saveUninitialized: true,
//           cookie: {
//             secure: false,
//             httpOnly: true,
//             expires: new Date(Date.now() + 1000 * 60 * 30)
//           }
//         }));
//       }
//     })();
//   }

//   constructor(private app: ExpressRestApp) { }

//   run() {
//     this.app.run();
//   }
// }