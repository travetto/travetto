/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { path } from '@travetto/manifest';


export const text = <>
  <c.StdHeader />

  This is primarily a set of command line tools for compiling and developing templates.  The primary input into this process is a {d.path('.email.html')} under the {d.path('resources/email')} folder.  This template drives the generation of the {d.input('html')} and {d.input('text')} outputs, as well as the {d.input('subject')} file.

  <c.Section title='Asset Management'>

    The templating process involves loading various assets (html, css, images), and so there is provision for asset management and loading.  The templating config allows for specifying asset paths, with the following paths (in order of precedence):

    <ol>
      <li>{d.path('%ROOT%/resources/email')}</li>
      <li>{d.path('@travetto/email-template/resources/email')}</li>
      <li>{d.path('foundation-emails/scss')} (specifically for {d.library('Sass')} files)</li>
    </ol>

    When looking up a resources, every asset folder is consulted, in order, and the first to resolve an asset wins.  This allows for overriding of default templating resources, as needed.  The compilation process will convert {d.path('.email.html')} files into {d.path('.compiled.html')}, {d.path('.compiled.text')} and {d.path('.compiled.subject')} suffixes to generate the outputs respectively.
  </c.Section>

  <c.Section title='Template Extension Points'>

    The template extension points are defined at:

    <ol>
      <li>{d.path('email/wrapper.html')} - This is the wrapping chrome for the email</li>
      <li>{d.path('email/main.scss')} - The entry point for adding, and overriding any {d.library('Sass')}</li>
    </ol>

    In addition to the overrides, you can find the list of available settings at <c.Ref title='Github' href='https://github.com/foundation/foundation-emails/blob/develop/scss/settings/_settings.scss' />
  </c.Section>

  <c.Section title='Template Compilation'>

    The general process is as follows:

    <ol>
      <li>Load in a general wrapper for email, located at {d.path('/resources/email/wrapper.html')}.</li>
      <li>Load in the general stylings as {d.library('Sass')}, from {d.path('/resources/email/main.scss')}.</li>
      <li>Resolving all mustache partial templates, at {d.path('/resources/email/**/*.email.html')}.</li>
      <li>Render the {d.library('Inky')} directives into the final {d.input('html')} output.</li>
      <li>Extract the subject from the {d.input('html')}'s {d.input('<title>')} tag, if present.</li>
      <li>Inline and optimize all images for email transmission.</li>
      <li>Generate markdown version of email to support the alternate {d.input('text')} format.</li>
    </ol >
  </c.Section >

  <c.Section title='Reusable Email Elements'>
    In building out emails, you may have common elements that you want to repeat.  If you have a common block, put that in a separate file and pull it in using partial notation, e.g. {d.input('{{{> email/common-element }}}')}.  All paths are relative to the {d.path('resource')} folder, which precludes the use of paths like {d.path('../file.html')}
  </c.Section>

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

  <c.Section title='Supporting Libraries'>

    Templating emails is achieved through a combination of multiple libraries, specifically:

    <ul>
      <li>{d.library('Inky')} is a email rendering framework that aims to provide a standard set of constructs for building visually appealing emails.  The version of inky being used is a complete rewrite to optimize for size and performance.</li>
      <li>{d.library('Sass')} used for styles compilation.</li>
      <li>{d.library('Mustache')} allows for interpolation of variables for personalized emails.</li>
    </ul>
  </c.Section>
  <c.Section title='Templating Example'>

    <c.Code title='Example inky template with mustache support' src='doc/email/example.email.html' />

    which will then interpolate the context to replace {d.input('left')} and {d.input('right')}, and compile to a final html output. When using {d.library('Mustache')} expressions, make sure to use {d.input('{{{ }}}')}, triple braces on complex text, to prevent {d.library('Mustache')} from escaping any characters.
  </c.Section>

  <c.Section title='Example inky template with partials'>

    Given two files, {d.path('resources/email/welcome.html')} and {d.path('resources/email/footer.hml')}

    <c.Code title='resources/email/welcome.html' src='doc/email/welcome.email.html' />

    <c.Code title='resources/email/footer.html' src='doc/email/footer.html' />

    The final template will render as:

    <c.Execution title='Final Output, with styling removed' cmd='trv' args={['main', 'doc/render.ts']} config={{
      env: {
        TRV_RESOURCES: path.resolve('doc')
      }
    }} />
  </c.Section>
</>;