const { doc: d, lib, inp, Section, List, Anchor, Ordered, Code, Mod, Execute, pth, SubSection } = require('@travetto/doc');


exports.text = d`
This is primarily a set of command line tools for compiling and developing templates.  The primary input into this process is a ${pth`.email.html`} under the ${pth`resources/email`} folder.  This template drives the generation of the ${inp`html`} and ${inp`text`} outputs, as well as the ${inp`subject`} file.

${Section('Asset Management')}

The templating process involves loading various assets (html, css, images), and so there is provision for asset management and loading.  The templating config allows for specifying asset paths, with the following paths (in order of precedence):

${Ordered(
  d`${pth`%ROOT%/resources/email`}`,
  d`${pth`@travetto/email-template/resources/email`}`,
  d`${pth`foundation-emails/scss`} (specifically for ${lib.Sass} files)`,
)}

When looking up a resources, every asset folder is consulted, in order, and the first to resolve an asset wins.  This allows for overriding of default templating resources, as needed.  The compilation process will convert ${pth`.email.html`} files into ${pth`.compiled.html`}, ${pth`.compiled.text`} and ${pth`.compiled.subject`} suffixes to generate the outputs respectively.  

${Section('Template Extension Points')}

The template extension points are defined at:

${Ordered(
  d`${pth`email/wrapper.html`} - This is the wrapping chrome for the email`,
  d`${pth`email/theme.scss`} - The entry point for adding, and overriding any ${lib.Sass}`,
)}

In addition to the overrides, you can find the list of available settings at ${Anchor('Github', 'https://github.com/foundation/foundation-emails/blob/develop/scss/settings/_settings.scss')}

${Section('Template Compilation')}

The general process is as follows:

${Ordered(
  d`Load in a general wrapper for email, located at ${pth`/resources/email/wrapper.html`}.`,
  d`Load in the general stylings as ${lib.Sass}, from ${pth`/resources/email/main.scss`}.`,
  d`Resolving all mustache partial templates, at ${pth`/resources/email/**/*.email.html`}.`,
  d`Render the ${lib.Inky} directives into the final ${inp`html`} output.`,
  d`Extract the subject from the ${inp`html`}'s ${inp`<title>`} tag, if present.`,
  d`Inline and optimize all images for email transmission.`,
  d`Generate markdown version of email to support the alternate ${inp`text`} format.`,
)}

${Section('Reusable Email Elements')}

In building out emails, you may have common elements that you want to repeat.  If you have a common block, put that in a separate file and pull it in using partial notation, e.g. ${inp`{{{> email/common-element }}}`}.  All paths are relative to the ${pth`resource`} folder, which precludes the use of paths like ${pth`../file.html`}

${Section('Images')}

When referencing an image from the ${pth`resources`} folder in a template, e.g.

${Code('Sample Image Reference', 'doc/resources/email/sample-image.html')}

The image will be extracted out and embedded in the email as a multi part message.  This allows for compression and optimization of images as well as externalizing resources that may not be immediately public.  The currently supported set of image types are:

${List('jpeg', 'png')}

${Section('Template Development')}

The module provides ${Mod(`cli`)} and ${lib.TravettoPlugin} support for email template development.

${SubSection('CLI Compilation')}

The module provides ${Mod('cli')} support for email template compilation also. Running

${Execute(`Running template compilation`, `travetto`, [`email:compile`, '-h'])}

Will convert all ${pth`.email.html`} files into the appropriate ${pth`.compiled.html`}, ${pth`.compiled.text`} and ${pth`.compiled.subject`} files.  These will be used during the running of the application.  By default these files are added to the ${pth`.gitignore`} as they are generally not intended to be saved but to be generated during the build process.

${SubSection(lib.TravettoPlugin)}
In addition to command line tools, the ${lib.TravettoPlugin} also supports:

${List(
  d`automatic compilation on change`,
  d`real-time rendering of changes visually`,
  d`ability to send test emails during development`,
  d`ability to define custom context for template rendering`
)}

${Section('Supporting Libraries')}

Templating emails is achieved through a combination of multiple libraries, specifically:

${List(
  d`${lib.Inky} is a email rendering framework that aims to provide a standard set of constructs for building visually appealing emails.  The version of inky being used is a complete rewrite to optimize for size and performance.`,
  d`${lib.Sass} used for styles compilation.`,
  d`${lib.Mustache} allows for interpolation of variables for personalized emails.`
)}

${Section('Templating Example')}

${Code('Example inky template with mustache support', 'doc/resources/email/example.email.html')}

which will then interpolate the context to replace ${inp`left`} and ${inp`right`}, and compile to a final html output. When using ${lib.Mustache} expressions, make sure to use ${inp`{{{ }}}`}, triple braces on complex text, to prevent ${lib.Mustache} from escaping any characters.

${Section(`Example inky template with partials`)}

Given two files, ${pth`resources/email/welcome.html`} and ${pth`resources/email/footer.hml`}

${Code('resources/email/welcome.html', `doc/resources/email/welcome.email.html`)}

${Code('resources/email/footer.html', `doc/resources/email/footer.html`)}

The final template will render as:

${Execute('Final Output, with styling removed', 'doc/render.ts')}
`;