/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />

  This is primarily a set of command line tools for compiling and developing templates.  The inputs are compiled files, generally under the {d.path('support/')} folder, that represents the necessary input for the email compilation.  {d.mod('EmailInky')} shows this pattern by leveraging {d.library('JSX')} bindings for the {d.library('Inky')} framework, allowing for compile-time checked templates.

  <c.Section title='Asset Management'>

    The templating process involves loading various assets (html, css, images), and so there is provision for asset management and loading.  The templating config allows for specifying asset paths, with the following paths (in order of precedence):

    <ol>
      <li>{d.path('%ROOT%/resources/email')}</li>
      <li>{d.path('@travetto/email-{engine}/resources/email')}</li>
    </ol>

    When looking up a resources, every asset folder is consulted, in order, and the first to resolve an asset wins.  This allows for overriding of default templating resources, as needed.  The compilation process will convert {d.path('.email.html')} files into {d.path('.compiled.html')}, {d.path('.compiled.text')} and {d.path('.compiled.subject')} suffixes to generate the outputs respectively.
  </c.Section>

  <c.Section title='Template Extension'>

    The template extension points are defined at:

    <ol>
      <li>{d.path('email/main.scss')} - The entry point for adding, and overriding any {d.library('Sass')}</li>
      <li>{d.path('email/{engine}.wrapper.html')} - The html wrapper for the specific templating engine implementation.</li>
    </ol>
  </c.Section>

  <c.Section title='Template Compilation'>

    The general process is as follows:

    <ol>
      <li>Load in the email template.</li>
      <li>Resolve any associated stylings for said template.</li>
      <li>Render template into html, text, and subject outputs.</li>
      <li>Inline and optimize all images for html email transmission.</li>
    </ol >
  </c.Section >

  <c.Section title='Images'>

    When referencing an image from the {d.path('resources')} folder in a template, e.g.

    <c.Code title='Sample Image Reference' src='doc/email/sample-image.html' />

    The image will be extracted out and embedded in the email as a multi part message.  This allows for compression and optimization of images as well as externalizing resources that may not be immediately public.  The currently supported set of image types are:

    <ul>
      <li>jpeg</li>
      <li>png</li>
    </ul>
  </c.Section>

  <c.Section title='Template Development'>

    The module provides {d.mod('Cli')} and {d.library('TravettoPlugin')} support for email template development.
  </c.Section>
  <c.Section title='CLI Compilation'>

    The module provides {d.mod('Cli')} support for email template compilation also. Running

    <c.Execution title='Running template compilation' cmd='trv' args={['email:compile', '-h']} />

    Will convert all {d.path('.email.html')} files into the appropriate {d.path('.compiled.html')}, {d.path('.compiled.text')} and {d.path('.compiled.subject')} files.  These will be used during the running of the application.  By default these files are added to the {d.path('.gitignore')} as they are generally not intended to be saved but to be generated during the build process.
  </c.Section>

  <c.Section title='VSCode Plugin'>
    In addition to command line tools, the {d.library('TravettoPlugin')} also supports:

    <ul>
      <li>automatic compilation on change</li>
      <li>real-time rendering of changes visually</li>
      <li>ability to send test emails during development</li>
      <li>ability to define custom context for template rendering</li>
    </ul>
  </c.Section>
</>;