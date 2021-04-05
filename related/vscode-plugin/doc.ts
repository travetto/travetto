import { d, lib, mod } from '@travetto/doc';
import { Test, Suite } from '@travetto/test';
import { Application } from '@travetto/app';

export const text = d`
${d.RawHeader('VS Code Plugin')}

The ${lib.TravettoPlugin} directly integrates with ${lib.Travetto} framework, exposing some of the ${mod.Cli} functionality.

The currently supported features are:
${d.List(
  'Real-time test evaluation and debugging',
  'Application launching with parameters',
  'Terminal integration for framework links',
  'Miscellaneous utilities',
)}

${d.Section('Testing')}

The test related functionality relies upon the ${mod.Test} module being installed, and used to define tests (${Suite} and ${Test}).

${d.SubSection('Real-time Test Evaluation')}

The real-time test functionality will re-evaluate your test code on save.  This means as you type and save, the test will run.  The test will provide feedback inline, using green to indicate success, red to indicate failure, and gray to indicate unknown.

${d.Image('Real-time Testing', 'https://travetto.dev/assets/images/vscode-plugin/real-time-testing.gif')}

${d.SubSection('Debugging Tests')}

While working on a test, if you want to debug it, you can press running ${d.Input('command-shift-t')} on OSX or ${d.Input('ctrl-shift-t')} on Windows/Linux.  This will start a debug session with the current line activated as a breakpoint.  This allows you to seamlessly jump into a debug session while writing tests.

${d.Image('Debugging Single Test', 'https://travetto.dev/assets/images/vscode-plugin/debug-single-test.gif')}

In addition to manual invocation at a line, each test has a ${lib.CodeLens}, that allows for trigger the test as well.

${d.Image('Debugging Single Test', 'https://travetto.dev/assets/images/vscode-plugin/debug-code-lens.gif')}


${d.SubSection('Commands')}

${d.List(
  d`${d.Input('Travetto: Debug Tests')} to force a running all the tests in debug mode.  Will not establish a breakpoint, but will use any existing breakpoints.`,
  d`${d.Input('Travetto: Re-run Tests')} to force a full re-run of all the tests in a given document`,
)}

${d.Section('Application Launching')}

While using the ${mod.App}, a common pattern is to use ${Application} annotations to define entry points into the application.  These entry points can take parameters, and if using the cli, you can invoke them with parameters, type checked and validated.

The plugin exposes this functionality as a command, to allow you to debug these applications directly from the editor.

${d.SubSection('Running')}

${d.Image('Run Workflow', 'https://travetto.dev/assets/images/vscode-plugin/run-workflow.gif')}

Launching relies upon the command ${d.Input('Travetto: Run New Application')}.  This will show you a list of the available entry points in the application, with the parameters they support.  Selecting an application will take you through the parameter flow to select inputs, and once all parameters are selected, your application will launch.

After running and selecting a configuration for an application, you can now access those configurations via ${d.Input('Travetto: Run Recent Application')}.  This allows you to execute a recent run that you can invoke immediately without prompting for inputs. If you find yourself running the same application multiple times, you can also invoke ${d.Input('Travetto: Run Most Recent Application')} to bypass application selection overall.

${d.SubSection('Exporting and Customizing')}

${d.Image('Export Workflow', 'https://travetto.dev/assets/images/vscode-plugin/run-export-workflow.gif')}

If at any point in time, you wish to modify the launch configuration of any application, you can execute the command ${d.Input('Travetto: Export Application Launch')}, and it will provide the same options as launch.  The only difference is that instead of running the application when it's done, you will have a new launch config in your debug launch configs.  This option is now completely independent from the plugin and can be modified without issue.

${d.SubSection('Commands')}

${d.List(
  d`${d.Input('Travetto: Run New Application')} to launch a new application config`,
  d`${d.Input('Travetto: Run Recent Application')} to launch a previously configured application`,
  d`${d.Input('Travetto: Run Most Recent Application')} to launch the most recently run configured application`,
  d`${d.Input('Travetto: Export Application Launch')} to export an application config`,
)}


${d.Section('Email Template Development')}

While using the ${mod.EmailTemplate} module, the desire to visual inspect output, as well as quickly test changes is paramount.  To that end, the plugin supports the ability to compile, view, and send email templates all from within the plugin.

The plugin exposes this functionality as a command, to allow you to debug these applications directly from the editor.

${d.Image('Editing', 'https://travetto.dev/assets/images/vscode-plugin/email-editing.gif')}

Any file that ends with ${d.Input('.tpl.html')} is assumed to be an email template, and will trigger background compilation upon editing the file.  All of the following commmands require the user to be actively editing the ${d.Input('.tpl.html')} file to be available.  

Additional, for rendering the email, a context may be needed to exercise the various logic paths. The plugin picks up ${d.Path('resources/email-dev-context.json')} by default, and if its not found, then an empty object is provided. 

${d.SubSection('Commands')}

${d.List(
  d`${d.Input('Travetto: Preview Email HTML')} to view the ${d.Input('html')} version of the rendered template`,
  d`${d.Input('Travetto: Preview Email Text')} to view the ${d.Input('text')} version of the rendered template`,
  d`${d.Input('Travetto: Send Email Template')} to trigger sending an email (requires SMTP configuration)`,
  d`${d.Input('Travetto: Email Template Context')} to view/edit the context file used to render the template`,
)}


${d.Section('Misc Utilities')}

Currently the supported commands are:
${d.List(
  d`${d.Input('Travetto: Clean')} to run the cli operation ${d.Input('travetto clean')}.  This will purge the project's cache, which is generally after workspace changes, like npm installs.`
)}


${d.Section('Release Info')}

${d.SubSection('Requirements')}
${d.List(
  d`You should have the ${lib.Travetto} framework installed, version 1.1.0 and higher.`,
  d`Tests require the ${mod.Test} module to be installed.`,
  d`Application running requires the ${mod.App} module to be installed.`,
)}

${d.Section('Known Issues')}

${d.List('None')}

${d.Section('Release Notes')}

${d.SubSection('1.1.x')}
${d.List(
  'Introduced the email template functionality'
)}

${d.SubSection('1.0.x')}
${d.List(
  'Complete rewrite of plugin',
  'Test framework integration completely inverted, and majority of logic offloaded to framework'
)}

${d.SubSection('0.5.x')}
${d.List(
  'Introduced application launching',
  'Resolved test stability issues',
  'Introduced clean functionality',
)}
`;