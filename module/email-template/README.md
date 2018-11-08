travetto: Email-Template
===

**Install: templating support for email module**
```bash
$ npm install @travetto/email-template
```

This is the primary templating email engine.  The templating process is built upon three primary ideas, with the final output being an [`inky`](https://github.com/zurb/inky) rendered html/text email.  

## Asset Management
The templating process involves loading various assets (html, css, images), and so there is provision for asset management and loading.  The templating config allows for specifying of asset paths, with the following defaults:

1. `@travetto/email/assets`
1. `%ROOT%/assets`
1. `foundation-emails/scss` (specifically for `sass` files)

When looking up a resources, every asset folder is consulted, in order, and the first to resolve an asset wins.  This allows for overriding of default templating resources, as needed.

## Template Compilation

The general process is as follows:

1. Load in a general wrapper for email.  The default is `@travetto/email/assets/html/wrapper.html`.
1. Load in the general stylings as `sass`. The default is `%ROOT%/assets/scss/app.scss`.
1. Resolving all mustache partial templates.
1. Render the `inky` directives into the final `html` output.
1. Inline and optimize all images for email transmission.
1. Generate markdown version of email to support the alternate text format.
1. Render the final output via the `mustache` templating process, interpolating the contextual data into the final output.

## Supporting Libraries
Templating emails is achieved through a combination of multiple libraries, specifically:

* [`inky`](https://github.com/zurb/inky) is a email rendering framework that aims to provide a standard set of constructs for building visually appealing emails.  The version of inky being used is a complete rewrite to optimize for size and performance.
* [`sass`](https://github.com/sass/dart-sass) used for sass compilation.
* [`mustache`](https://github.com/janl/mustache.js/) allows for interpolation of variables for personalized emails.
* [`pngquant`](https://pngquant.org/) is used to compress images on the fly for bandwidth optimizations. `pngquant` is not installed as a dependency, but relies upon either the binary being already installed, or spinning up a `docker` container to use as a way of executing the binary.

**NOTE** Many of the libraries were chosen due to size and number of overall dependencies.  Any performance issues are mitigated accordingly.

## Example
A sample template could look like:

**Code: Example inky template with mustache support**
```xml
<row>
  <columns large="{{left}}">Bob</columns>
  <columns large="{{right}}"></columns>
</row>
```

which will then interpolate the context to replace `left` and `right`, and compile to a final html output. When using mustache expressions, make sure to use `{{{ }}}`, triple braces on complex text, to prevent mustache from escaping any characters.