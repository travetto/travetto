travetto: Email
===
A standard API for sending and templating emails. The templating engine is optional, and will only fail if you attempt to send a templatedEmail without declaring the dependency first.

To send an email, a transport must be defined.  By default the module ships with a `NullTransport` which will just consume messages quietly.  The structure of the API is derived from  [`nodemailer`](https://nodemailer.com/about/), but is compatible with any library that can handle the `MessageOptions` input.

Given the amorphous nature of the transports, in `MailConfig`, the `transport` field is open for any configuration that you may want there.

## Extensions
Due to the connection with `nodemailer`, all nodemailer extensions should be usable out of the box, assuming the correct dependencies are installed.

When sending emails you can use the following transports:
* `sendmail` to send all messages via the sendmail operation
* `smtp` to utilizing the protocol directly and send to a specific server
* `ses` send via Amazon's SES apis
