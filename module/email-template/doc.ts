import { d, lib, mod } from '@travetto/doc';


export const text = d`
${d.Header()}

This is primarily a set of command line tools for compiling and developing templates.  The primary input into this process is a ${d.Path('.email.html')} under the ${d.Path('resources/email')} folder.  This template drives the generation of the ${d.Input('html')} and ${d.Input('text')} outputs, as well as the ${d.Input('subject')} file.

${d.Section('Asset Management')}

The templating process involves loading various assets (html, css, images), and so there is provision for asset management and loading.  The templating config allows for specifying asset paths, with the following paths (in order of precedence):

${d.Ordered(
  d`${d.Path('%ROOT%/resources/email')}`,
  d`${d.Path('@travetto/email-template/resources/email')}`,
  d`${d.Path('foundation-emails/scss')} (specifically for ${lib.Sass} files)`,
)}

When looking up a resources, every asset folder is consulted, in order, and the first to resolve an asset wins.  This allows for overriding of default templating resources, as needed.  The compilation process will convert ${d.Path('.email.html')} files into ${d.Path('.compiled.html')}, ${d.Path('.compiled.text')} and ${d.Path('.compiled.subject')} suffixes to generate the outputs respectively.  

${d.Section('Template Extension Points')}

The template extension points are defined at:

${d.Ordered(
  d`${d.Path('email/wrapper.html')} - This is the wrapping chrome for the email`,
  d`${d.Path('email/theme.scss')} - The entry point for adding, and overriding any ${lib.Sass}`,
)}

In addition to the overrides, you can find the list of available settings at ${d.Anchor('Github', 'https://github.com/foundation/foundation-emails/blob/develop/scss/settings/_settings.scss')}

${d.Section('Template Compilation')}

The general process is as follows:

${d.Ordered(
  d`Load in a general wrapper for email, located at ${d.Path('/resources/email/wrapper.html')}.`,
  d`Load in the general stylings as ${lib.Sass}, from ${d.Path('/resources/email/main.scss')}.`,
  d`Resolving all mustache partial templates, at ${d.Path('/resources/email/**/*.email.html')}.`,
  d`Render the ${lib.Inky} directives into the final ${d.Input('html')} output.`,
  d`Extract the subject from the ${d.Input('html')}'s ${d.Input('<title>')} tag, if present.`,
  d`Inline and optimize all images for email transmission.`,
  d`Generate markdown version of email to support the alternate ${d.Input('text')} format.`,
)}

${d.Section('Reusable Email Elements')}

In building out emails, you may have common elements that you want to repeat.  If you have a common block, put that in a separate file and pull it in using partial notation, e.g. ${d.Input('{{{> email/common-element }}}')}.  All paths are relative to the ${d.Path('resource')} folder, which precludes the use of paths like ${d.Path('../file.html')}

${d.Section('Images')}

When referencing an image from the ${d.Path('resources')} folder in a template, e.g.

${d.Code('Sample Image Reference', 'doc/resources/email/sample-image.html')}

The image will be extracted out and embedded in the email as a multi part message.  This allows for compression and optimization of images as well as externalizing resources that may not be immediately public.  The currently supported set of image types are:

${d.List('jpeg', 'png')}

${d.Section('Template Development')}

The module provides ${mod.Cli} and ${lib.TravettoPlugin} support for email template development.

${d.SubSection('CLI Compilation')}

The module provides ${mod.Cli} support for email template compilation also. Running

${d.Execute('Running template compilation', 'trv', ['email:compile', '-h'])}

Will convert all ${d.Path('.email.html')} files into the appropriate ${d.Path('.compiled.html')}, ${d.Path('.compiled.text')} and ${d.Path('.compiled.subject')} files.  These will be used during the running of the application.  By default these files are added to the ${d.Path('.gitignore')} as they are generally not intended to be saved but to be generated during the build process.

${d.SubSection(lib.TravettoPlugin)}
In addition to command line tools, the ${lib.TravettoPlugin} also supports:

${d.List(
  d`automatic compilation on change`,
  d`real-time rendering of changes visually`,
  d`ability to send test emails during development`,
  d`ability to define custom context for template rendering`
)}

${d.Section('Supporting Libraries')}

Templating emails is achieved through a combination of multiple libraries, specifically:

${d.List(
  d`${lib.Inky} is a email rendering framework that aims to provide a standard set of constructs for building visually appealing emails.  The version of inky being used is a complete rewrite to optimize for size and performance.`,
  d`${lib.Sass} used for styles compilation.`,
  d`${lib.Mustache} allows for interpolation of variables for personalized emails.`
)}

${d.Section('Templating Example')}

${d.Code('Example inky template with mustache support', 'doc/resources/email/example.email.html')}

which will then interpolate the context to replace ${d.Input('left')} and ${d.Input('right')}, and compile to a final html output. When using ${lib.Mustache} expressions, make sure to use ${d.Input('{{{ }}}')}, triple braces on complex text, to prevent ${lib.Mustache} from escaping any characters.

${d.Section('Example inky template with partials')}

Given two files, ${d.Path('resources/email/welcome.html')} and ${d.Path('resources/email/footer.hml')}

${d.Code('resources/email/welcome.html', 'doc/resources/email/welcome.email.html')}

${d.Code('resources/email/footer.html', 'doc/resources/email/footer.html')}

The final template will render as:

${d.Execute('Final Output, with styling removed', 'doc/render.ts')}
`;