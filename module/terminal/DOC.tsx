/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module provides basic support for interacting with the terminal, and provides the basis for output colorization and the basic command line interactions.  The functionality can be broken down into:

  <ul>
    <li>Terminal Interactions</li>
  </ul>

  <c.Section title='Terminal Interactions'>
    Within the {d.library('Travetto')} framework, there are plenty of command line interactions that are enhanced with additional interactivity.  This mainly revolves around indicating progress while a program is executing.  The module provides support for:

    <ul>
      <li>Progress Bars</li>
      <li>Waiting Indicators</li>
      <li>Streaming Content</li>
    </ul>

    This is generally meant for use within the framework, and so is highly tailored to the specific needs and scenarios.  You can see this pattern play out in the {d.mod('Compiler')} progress output, or in {d.mod('Pack')}'s output. <br />

    In these scenarios, the dynamic behaviors are dependent on having an interactive TTY.  When running without access to a proper stdin, the output will default to basic line printing.    This dynamic behavior can also be disabled using the environment variable {d.field('TRV_QUIET')}.  When set to {d.input('1')} will provide a minimal text-based experience.
  </c.Section>
</>;