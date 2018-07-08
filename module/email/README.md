travetto: Email
===

This module provides two main pieces of functionality. Specifically the ability to template emails, and the the ability to send them.

## Templating
Templating emails is achieved through a combination of multiple libraries, specifically:
* [`inky`](https://github.com/zurb/inky) is a email rendering framework that aims to provide a standard set of constructs for building visually appealing emails.
* [`inline-css`](https://github.com/jonkemp/inline-css) inlines CSS in related sheets or the head of the html document, into the html body contents (some email clients require this).
* [`marked`](https://github.com/markedjs/marked) is used to generate the plain text version of the email, rendering html into markdown
* [`mustache`](https://github.com/janl/mustache.js/) allows for interpolation of variables for personalized emails.
* [`pngquant`](https://pngquant.org/) is used to compress images on the fly for bandwidth optimizations. `pngquant` is not installed as a dependency, but relies upon either the binary being already installed, or spinning up a docker container to use as a way of executing the binary.

**NOTE** Many of the libraries were chosen due to size and number of overall dependencies.  Any performance issues are mitigated accordingly.

Additionally, the module provides a base email template wrapper that provides the structure [`inky`](https://github.com/zurb/inky) needs.

A sample template could look like:
```xml
<row>
  <columns large="{{left}}">Bob</columns>
  <columns large="{{right}}"></columns>
</row>
```

which will then interpolate the context to replace `left` and `right`, and compile to a final html output. When using mustache expression, make sure to use `{{{ }}}`, triple braces, to prevent mustache from escaping any characters.

## Assets

Assets, e.g. sass files, html templates and images, are also able to be referenced in the during compilation. The asset resolution primarily two paths that will be examined when a resource is referenced:
1. `<project>/assets/email` for local assets.  
2. `node_modules/@travetto/email/assets/email` for pre-bundled assets from this module.

In addition to the above resolution, sass files are loaded from a fixed sub directory called `assets/email/scss`.  To reference sass files and images in your template, just use relative paths.  The relative paths will be resolved into local assets.  For images the contents will be optimized and inlined as a data-uri.  If you do not want to inline your images, you will need to provide an external URL.

## Sending
The actual sending of emails, uses [`nodemailer`](https://nodemailer.com/about/) as the general framework.  When sending emails you can use the following transports:
* `none` to discard all emails
* `sendmail` to send all messages via the sendmail operation
* `smtp` to utilizing the protocol directly and send to a specific server