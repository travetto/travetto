# Email
## Email transmission module.

**Install: @travetto/email**
```bash
npm install @travetto/email
```

A standard API for sending and rendering emails. The mail transport must be defined to allow for mail to be sent properly.  Out of the box, the only transport available by default is the [NullTransport](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module/email/src/transport.ts#L13) which will just drop emails. The structure of the API is derived from  [nodemailer](https://nodemailer.com/about/), but is compatible with any library that can handle the [MessageOptions](src/types.ts#L36) input.

To expose the necessary email transport, the following pattern is commonly used:

**Code: Declaring the null transport for development**
```typescript
import { InjectableFactory } from '@travetto/di';
import { NullTransport } from '@travetto/email/src/transport';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NullTransport();
  }
}
```

Given the amorphous nature of transports, the `transport` field in [MailConfig](https://github.com/travetto/travetto/tree/1.0.0-docs-overhaul/module/email/src/config.ts#L7) is open for any configuration that you may want there. Additionally, the templating engine is optional.  The code will only fail if you attempt to send a templated email without declaring the dependency first.

## Nodmailer - Extension

Due to the connection with [nodemailer](https://nodemailer.com/about/), all extensions should be usable out of the box. The primary [nodemailer](https://nodemailer.com/about/) modules are provided (assuming dependencies are installed):

**Code: `sendmail` to send all messages via the sendmail operation**
```typescript
import { NodemailerTransport } from '@travetto/email';
import { InjectableFactory } from '@travetto/di';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NodemailerTransport(require('nodemailer-sendmail-transport'));
  }
}
```

**Code: `smtp` to send all messages via the smtp operation**
```typescript
import { NodemailerTransport } from '@travetto/email';
import { InjectableFactory } from '@travetto/di';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NodemailerTransport(require('nodemailer-smtp-transport'));
  }
}
```

**Code: `ses` to send all messages via the ses operation**
```typescript
import { NodemailerTransport } from '@travetto/email';
import { InjectableFactory } from '@travetto/di';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NodemailerTransport(require('nodemailer-ses-transport'));
  }
}
```

