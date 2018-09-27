travetto: Email-Template
===

## Templating
Templating emails is achieved through a combination of multiple libraries, specifically:

* [`inky`](https://github.com/zurb/inky) is a email rendering framework that aims to provide a standard set of constructs for building visually appealing emails.  The version of inky being used is a complete rewrite to optimize for size and performance.
* [`marked`](https://github.com/markedjs/marked) is used to generate the plain text version of the email, rendering html into markdown
* [`mustache`](https://github.com/janl/mustache.js/) allows for interpolation of variables for personalized emails.
* [`pngquant`](https://pngquant.org/) is used to compress images on the fly for bandwidth optimizations. `pngquant` is not installed as a dependency, but relies upon either the binary being already installed, or spinning up a `docker` container to use as a way of executing the binary.

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
1. `<project>/assets` for local assets.  
2. `node_modules/@travetto/email-template/assets` for pre-bundled assets from this module.

In addition to the above resolution, sass files are loaded from a fixed sub directory called `assets/scss`.  To reference sass files and images in your template, just use relative paths.  The relative paths will be resolved into local assets.  For images the contents will be optimized and inlined as a data-uri.  If you do not want to inline your images, you will need to provide an external URL.