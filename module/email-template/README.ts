import { d, Library, inp, Section, List, Ordered, Code, Mod, Command, Terminal, Execute, pth } from '@travetto/doc';

const Inky = Library(`inky`, 'https://github.com/zurb/inky');
const Sass = Library('sass', 'https://github.com/sass/dart-sass');
const Mustache = Library(`mustache`, `https://github.com/janl/mustache.js/`);

export default d`
This is primarily a set of command line tools for compiling and developing templates.  The templating process is built upon three primary ideas, with the final output being an ${Inky} rendered html/text email.  

${Section('Asset Management')}

The templating process involves loading various assets (html, css, images), and so there is provision for asset management and loading.  The templating config allows for specifying of asset paths, with the following paths (in order of precedence):

${Ordered(
  d`${pth`%ROOT%/resources`}`,
  d`${pth`@travetto/email-template/resources`}`,
  d`${pth`foundation-emails/scss`} (specifically for ${Sass} files)`,
)}

When looking up a resources, every asset folder is consulted, in order, and the first to resolve an asset wins.  This allows for overriding of default templating resources, as needed.  The compilation process with convert ${inp`.tpl.html`} files into ${inp`.compiled.html`} and ${inp`.compiled.txt`} suffixes to generate the html and text outputs respectively.  

${Section('Template Compilation')}

The general process is as follows:

${Ordered(
  d`Load in a general wrapper for email, located at ${pth`/resources/email/wrapper.html`}.`,
  d`Load in the general stylings as ${Sass}, from ${pth`/resources/email/app.scss`}.`,
  d`Resolving all mustache partial templates, at ${pth`/resources/email/**/*.tpl.html`}.`,
  d`Render the ${Inky} directives into the final ${inp`html`} output.`,
  d`Inline and optimize all images for email transmission.`,
  d`Generate markdown version of email to support the alternate text format.`,
)}

${Section('Reusable Email Elements')}

In building out emails, you may have common elements that you want to repeat.  If you have a common block, put that in a separate file and pull it in using partial notation, e.g. ${inp`{{{> email/common-element }}}`}

${Section('Images')}

When referencing an image from the ${inp`resources`} folder in a template, e.g.

${Code('Sample Image Reference', 'alt/docs/resources/sample-image.html')}

The image will be extracted out and embedded in the email as a multi part message.  This allows for compression and optimization of images as well as externalizing resources that may not be immediately public.  The currently supported set of image types are:

${List('jpeg', 'png')}

${Section('Template Development')}

The module provides ${Mod(`cli`)} support for email template development. Running

${Execute(`Running template development environment`, `travetto`, [`email:dev`, '-h'])}

${Section('Template Compilation')}

The module provides ${Mod('cli')} support for email template compilation also. Running

${Execute(`Running template compilation`, `travetto`, [`email:compile`, '-h'])}

Will convert all ${inp`.tpl.html`} files into the appropriate ${inp`.compiled.html`} and ${inp`.compiled.txt`} files.  These will be used during the execution of the application.

${Section('Supporting Libraries')}

Templating emails is achieved through a combination of multiple libraries, specifically:

${List(
  d`${Inky} is a email rendering framework that aims to provide a standard set of constructs for building visually appealing emails.  The version of inky being used is a complete rewrite to optimize for size and performance.`,
  d`${Sass} used for styles compilation.`,
  d`${Mustache} allows for interpolation of variables for personalized emails.`
)}

${Section('Templating Example')}

${Code('Example inky template with mustache support', 'alt/docs/resources/email/example.tpl.html')}

which will then interpolate the context to replace ${inp`left`} and ${inp`right`}, and compile to a final html output. When using ${Mustache} expressions, make sure to use ${inp`{{{ }}}`}, triple braces on complex text, to prevent ${Mustache} from escaping any characters.

${Section(`Example inky template with partials`)}

Given two files, ${pth`resources/email/welcome.html`} and ${pth`resources/email/footer.hml`}

${Code('resources/email/welcome.html', `alt/docs/resources/email/welcome.html`)}

${Code('resources/email/footer.html', `alt/docs/resources/email/footer.html`)}

The final template will render as:

${Execute('Final Output, with styling removed', 'alt/docs/src/render.ts')}
`;