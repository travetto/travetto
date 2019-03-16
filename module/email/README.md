travetto: Email
===

**Install: primary**
```bash
$ npm install @travetto/email
```

A standard API for sending and rendering emails. The mail transport must be defined to allow for mail to be sent properly.  Out of the box, the only transport available by default is the `NullTransport` which will just drop emails. The structure of the API is derived from  [`nodemailer`](https://nodemailer.com/about/), but is compatible with any library that can handle the `MessageOptions` input.

To expose the necessary email transport, the following pattern is commonly used:

**Code: Declaring the null transport for development** 
```typescript
class Config {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NullTransport();
  }
}
```

Given the amorphous nature of transports, the `transport` field in `MailConfig` is open for any configuration that you may want there. Additionally, the templating engine is optional.  The code will only fail if you attempt to send a templated email without declaring the dependency first.

## Nodemailer - Extension
Due to the connection with `nodemailer`, all nodemailer extensions should be usable out of the box. The primary `nodemailer` modules are provided (assuming dependencies are installed):

`sendmail` to send all messages via the sendmail operation

**Code: Sendmail transport from nodemailer**
```typescript
import { NodeMailerTransport } from '@travetto/email/src/extension/nodemailer';

class Config {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NodeMailerTransport(require('nodemailer-sendmail-transport'));
  }
}
```

`smtp` to utilizing the protocol directly and send to a specific server

**Code: SMTP transport from nodemailer**
```typescript
import { NodeMailerTransport } from '@travetto/email/src/extension/nodemailer';

class Config {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NodeMailerTransport(require('nodemailer-smtp-transport'));
  }
}
```

`ses` send via Amazon's SES apis

**Code: SES transport from nodemailer**
```typescript
import { NodeMailerTransport } from '@travetto/email/src/extension/nodemailer';

class Config {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NodeMailerTransport(require('nodemailer-ses-transport'));
  }
}
```
