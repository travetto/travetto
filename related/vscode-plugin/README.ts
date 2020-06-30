import { RawHeader, doc as d, inp, lib, Image, Mod, List, Section, SubSection, Command } from '@travetto/doc';
import { Test, Suite } from '@travetto/test';
import { Application } from '@travetto/app';

export const header = false;

export default d`
${RawHeader('VS Code Plugin')}

The ${lib.TravettoPlugin} directly integrates with ${lib.Travetto} framework, exposing some of the ${Mod('cli')} functionality.

The currently supported features are:
${List(
  'Real-time test evaluation and debugging',
  'Application launching with parameters',
  'Miscellaneous utilities',
)}

${Section('Testing')}

The test related functionality relies upon the ${Mod('test')} module being installed, and used to define tests (${Suite} and ${Test}).

${SubSection('Real-time Test Evaluation')}

The real-time test functionality will re-evaluate your test code on save.  This means as you type and save, the test will run.  The test will provide feedback inline, using green to indicate success, red to indicate failure, and gray to indicate unknown.

${Image('Real-time Testing', 'images/real-time-testing.gif')}

${SubSection('Debugging Tests')}

While working on a test, if you want to debug it, you can press running ${inp`command-shift-t`} on OSX or ${inp`ctrl-shift-t`} on Windows/Linux.  This will start a debug session with the current line activated as a breakpoint.  This allows you to seamlessly jump into a debug session while writing tests.

${Image('Debugging Single Test', 'images/debug-single-test.gif')}

In addition to manual invocation at a line, each test has a ${lib.CodeLens}, that allows for trigger the test as well.

${Image('Debugging Single Test', 'images/debug-code-lens.gif')}


${SubSection('Commands')}

${List(
  d`${inp`Travetto: Debug Tests`} to force a running all the tests in debug mode.  Will not establish a breakpoint, but will use any existing breakpoints.`,
  d`${inp`Travetto: Re-run Tests`} to force a full re-run of all the tests in a given document`,
)}

${Section('Application Launching')}

While using the ${Mod('app')}, a common pattern is to use ${Application} annotations to define entry points into the application.  These entry points can take parameters, and if using the cli, you can invoke them with parameters, type checked and validated.

The plugin exposes this functionality as a command, to allow you to debug these applications directly from the editor.

${SubSection('Running')}

${Image('Run Workflow', 'images/run-workflow.gif')}

Launching relies upon the command ${inp`Travetto: Run New Application`}.  This will show you a list of the available entry points in the application, with the parameters they support.  Selecting an application will take you through the parameter flow to select inputs, and once all parameters are selected, your application will launch.

After running and selecting a configuration for an application, you can now access those configurations via ${inp`Travetto: Run Recent Application`}.  This allows you to execute a recent run that you can invoke immediately without prompting for inputs. If you find yourself running the same application multiple times, you can also invoke ${inp`Travetto: Run Most Recent Application`} to bypass application selection overall.

${SubSection('Exporting and Customizing')}

${Image('Export Workflow', 'images/run-export-workflow.gif')}

If at any point in time, you wish to modify the launch configuration of any application, you can execute the command ${inp`Travetto: Export Application Launch`}, and it will provide the same options as launch.  The only difference is that instead of running the application when it's done, you will have a new launch config in your debug launch configs.  This option is now completely independent from the plugin and can be modified without issue.

${SubSection('Commands')}

${List(
  d`${inp`Travetto: Run New Application`} to launch a new application config`,
  d`${inp`Travetto: Run Recent Application`} to launch a previously configured application`,
  d`${inp`Travetto: Run Most Recent Application`} to launch the most recently run configured application`,
  d`${inp`Travetto: Export Application Launch`} to export an application config`,
)}

${Section('Misc Utilities')}

Currently the supported commands are:
${List(
  d`${inp`Travetto: Clean`} to run the cli operation ${inp`travetto clean`}.  This will purge the project's cache, which is generally after workspace changes, like npm installs.`
)}


${Section('Release Info')}

${SubSection('Requirements')}
${List(
  d`You should have the ${lib.Travetto} framework installed, version 1.0.0 and higher.`,
  d`Tests require the ${Mod('test')} module to be installed.`,
  d`Application running requires the ${Mod('app')} module to be installed.`,
)}

${Section('Known Issues')}

Calling out known issues can help limit users opening duplicate issues against your extension.

${Section('Release Notes')}

${SubSection('0.5.x')}
${List(
  `Introduced application launching`,
  `Resolved test stability issues`,
  `Introduced clean functionality`,
)}
`;

