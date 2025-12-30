/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { Test, Suite } from '@travetto/test';
import { CliCommand } from '@travetto/cli';

export const text = <>
  <c.Header title='VS Code Plugin' />

  The {d.library('TravettoPlugin')} directly integrates with {d.library('Travetto')} framework, exposing some of the {d.mod('Cli')} functionality. <br />

  The currently supported features are:
  <ul>
    <li>Real-time test evaluation and debugging</li>
    <li>Cli command launching with parameters</li>
    <li>Terminal integration for framework links</li>
    <li>Miscellaneous utilities</li>
  </ul>

  <c.Section title='Testing'>

    The test related functionality relies upon the {d.mod('Test')} module being installed, and used to define tests ({Suite} and {Test}).

    <c.SubSection title='Real-time Test Evaluation'>

      The real-time test functionality will re-evaluate your test code on save.  This means as you type and save, the test will run.  The test will provide feedback inline, using green to indicate success, red to indicate failure, and gray to indicate unknown.

      <c.Image title='Real-time Testing' href='https://travetto.dev/assets/images/vscode-plugin/real-time-testing.gif' />
    </c.SubSection>

    <c.SubSection title='Debugging Tests'>

      While working on a test, if you want to debug it, you can press running {d.input('command-shift-t')} on OSX or {d.input('ctrl-shift-t')} on Windows/Linux.  This will start a debug session with the current line activated as a breakpoint.  This allows you to seamlessly jump into a debug session while writing tests.

      <c.Image title='Debugging Single Test' href='https://travetto.dev/assets/images/vscode-plugin/debug-single-test.gif' />

      In addition to manual invocation at a line, each test has a {d.library('CodeLens')}, that allows for trigger the test as well.

      <c.Image title='Debugging Single Test' href='https://travetto.dev/assets/images/vscode-plugin/debug-code-lens.gif' />
    </c.SubSection>

    <c.SubSection title='Commands'>

      <ul>
        <li>{d.input('Travetto: Debug Tests')} to force a running all the tests in debug mode.  Will not establish a breakpoint, but will use any existing breakpoints.</li>
        <li>{d.input('Travetto: Re-run Tests')} to force a full re-run of all the tests in a given document</li>
      </ul>
    </c.SubSection>
  </c.Section>

  <c.Section title='CLI Running'>

    While using the {d.mod('Cli')}, a common pattern is to use {CliCommand} annotations to define entry points into the application.  These entry points can take parameters, and if using the cli, you can invoke them with parameters, type checked and validated. <br />

    The plugin exposes this functionality as a command, to allow you to debug these commands directly from the editor.

    <c.SubSection title='Running'>

      <c.Image title='Run Workflow' href='https://travetto.dev/assets/images/vscode-plugin/run-workflow.gif' />

      Launching relies upon the command {d.input('Travetto: Run New Command')}.  This will show you a list of the available entry points in the project, with the parameters they support.  Selecting a command will take you through the parameter flow to select inputs, and once all parameters are selected, your command will launch.

      After running and selecting a configuration for a command, you can now access those configurations via {d.input('Travetto: Run Recent Command')}.  This allows you to execute a recent run that you can invoke immediately without prompting for inputs. If you find yourself running the same application multiple times, you can also invoke {d.input('Travetto: Run Most Recent Command')} to bypass application selection overall.
    </c.SubSection>
    <c.SubSection title='Exporting and Customizing'>

      <c.Image title='Export Workflow' href='https://travetto.dev/assets/images/vscode-plugin/run-export-workflow.gif' />

      If at any point in time, you wish to modify the launch configuration of any command, you can execute {d.input('Travetto: Export Command')}, and it will provide the same options as launch.  The only difference is that instead of running the command, you will have a new debug launch config.  This option is now completely independent from the plugin and can be modified without issue.
    </c.SubSection>
    <c.SubSection title='Commands'>

      <ul>
        <li>{d.input('Travetto: Run New Command')} to launch a new command config</li>
        <li>{d.input('Travetto: Run Recent Command')} to launch a previously configured command</li>
        <li>{d.input('Travetto: Run Most Recent Command')} to launch the most recently run configured command</li>
        <li>{d.input('Travetto: Export Command')} to export an command config</li>
      </ul>
    </c.SubSection>

    <c.SubSection title='Running from Command Line'>
      When invoking commands from the terminal (within VSCode), the CLI will delegate the relevant commands to the VSCode plugin.  This allows for more customization of entry points, as well as ability to leverage aliases/scripts (e.g. {d.input('npm start')}) as a way of unifying the tooling.
    </c.SubSection>
  </c.Section>

  <c.Section title='Email Template Development'>

    While developing emails, the desire to visual inspect output, as well as quickly test changes is paramount.  To that end, the plugin supports the ability to compile, view, and send email templates all from within the plugin. <br />

    The plugin exposes this functionality as a command, to allow you to debug these applications directly from the editor.

    <c.Image title='Editing' href='https://travetto.dev/assets/images/vscode-plugin/email-editing.gif' />

    Any file that ends with {d.input('.email.tsx')} is assumed to be an email template, and will trigger background compilation upon editing the file.  All of the following commands require the user to be actively editing the {d.input('.email.tsx')} file to be available. <br />

    Additional, for rendering the email, a context may be needed to exercise the various logic paths. The plugin picks up {d.path('resources/email/local.yml')} by default, and if its not found, then an empty object is provided.

    <c.SubSection title='Commands'>

      <ul>
        <li>{d.input('Travetto: Preview Email HTML')} to view the {d.input('html')} version of the rendered template</li>
        <li>{d.input('Travetto: Preview Email Text')} to view the {d.input('text')} version of the rendered template</li>
        <li>{d.input('Travetto: Send Email Template')} to trigger sending an email (requires SMTP configuration)</li>
        <li>{d.input('Travetto: Email Template Context')} to view/edit the context file used to render the template</li>
      </ul>
    </c.SubSection>
  </c.Section>

  <c.Section title='Misc Utilities'>

    Currently the supported commands are:
    <ul>
      <li>{d.input('Travetto: Clean')} to run the cli operation {d.input('travetto clean')}.  This will purge the project's cache, which is generally after workspace changes, like npm installs.</li>
    </ul>
  </c.Section>

  <c.Section title='Release Info'>

    <c.SubSection title='Requirements'>
      <ul>
        <li>You should have the {d.library('Travetto')} framework installed, version 1.1.0 and higher.</li>
        <li>Tests require the {d.mod('Test')} module to be installed.</li>
        <li>CLI command running requires the {d.mod('Cli')} module to be installed.</li>
      </ul>
    </c.SubSection>
  </c.Section>

  <c.Section title='Known Issues'>
    <ul>
      <li>None</li>
    </ul>
  </c.Section>

  <c.Section title='Release Notes'>

    <c.SubSection title='1.1.x'>
      <ul>
        <li>Introduced the email template functionality</li>
      </ul>
    </c.SubSection>

    <c.SubSection title='1.0.x'>
      <ul>
        <li>Complete rewrite of plugin</li>
        <li>Test framework integration completely inverted, and majority of logic offloaded to framework</li>
      </ul>
    </c.SubSection>

    <c.SubSection title='0.5.x'>
      <ul>
        <li>Introduced application launching</li>
        <li>Resolved test stability issues</li>
        <li>Introduced clean functionality</li>
      </ul>
    </c.SubSection>
  </c.Section>
</>;