FIXME: Rewrite

travetto: Email-Template
===

**Install: templating support for email module**
```bash
$ npm install @travetto/email-template
```

This is the primary templating email engine.  The templating process is built upon three primary ideas, with the final output being an [`inky`](https://github.com/zurb/inky) rendered html/text email.  

## Asset Management
The templating process involves loading various assets (html, css, images), and so there is provision for asset management and loading.  The templating config allows for specifying of asset paths, with the following paths (in order of precedence):

1. `%ROOT%/resources`
1. `@travetto/email-template/resources`
1. `foundation-emails/scss` (specifically for `sass` files)

When looking up a resources, every asset folder is consulted, in order, and the first to resolve an asset wins.  This allows for overriding of default templating resources, as needed.  All email `.html` files, are loaded automatically and can be referenced by individual file name.  E.g. `/resources/email/receipt.html` can be referenced by the name `email/receipt`.

## Template Compilation

The general process is as follows:

1. Load in a general wrapper for email, located at `/resources/email/wrapper.html`.
1. Load in the general stylings as `sass`, from `/resources/email/app.scss`.
1. Resolving all mustache partial templates, at `/resources/email/**/*.html`.
1. Render the `inky` directives into the final `html` output.
1. Inline and optimize all images for email transmission.
1. Generate markdown version of email to support the alternate text format.
1. Render the final output via the `mustache` templating process, interpolating the contextual data into the final output.

## Common Email Elements
In building out emails, you may have common elements that you want to repeat.  If you have a common block, put that in a separate file and pull it in using partial notation, e.g. `{{{> email/common-element}}}`

## Images
When referencing an image from the `resources` folder in a template, e.g.

```html
<img src="/email/logo.png">
```

The image will be extracted out and embedded in the email as a multi part message.  This allows for compression and optimization of images as well as externalizing resources that may not be immediately public. 

## Template Development
The module provides [`cli`](https://github.com/travetto/travetto/tree/master/module/cli) support for email template development. Running 

**Shell: running template development environment**
```bash
$ npx trv email-template
```

In the development environment, you can toggle between HTML and text views, as well as provide JSON context for the email to see how it would look with real data. This process supports live reload, and should help facilitate any email design work.

## Supporting Libraries
Templating emails is achieved through a combination of multiple libraries, specifically:

* [`inky`](https://github.com/zurb/inky) is a email rendering framework that aims to provide a standard set of constructs for building visually appealing emails.  The version of inky being used is a complete rewrite to optimize for size and performance.
* [`sass`](https://github.com/sass/dart-sass) used for sass compilation.
* [`mustache`](https://github.com/janl/mustache.js/) allows for interpolation of variables for personalized emails.

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

## Example inky template with partials
Given two files, `resources/email/welcome.html` and `resources/email/footer.hml`

**Code: assets/welcome.html**
```xml
<row>
  <row>
    <columns large="{{left}}">Bob</columns>
    <columns large="{{right}}"></columns>
  </row>
  {{{> email/footer }}}
</row>
```

**Code: assets/footer.html**
```xml
<row>
  This is a footer
  <a href="{{salesLink}}">Sales Link</a>
</row>
```

The final template will render as

**Code: final output**
```xml
<row>
  <row>
    <columns large="{{left}}">Bob</columns>
    <columns large="{{right}}"></columns>
  </row>
  <row>
    This is a footer
    <a href="{{salesLink}}">Sales Link</a>
  </row>
</row>
```