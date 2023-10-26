/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module provides basic support for interacting with the terminal, and provides the basis for output colorization and the basic command line interactions.  The functionality can be broken down into:

  <ul>
    <li>Output Colorization</li>
    <li>Terminal Interactions</li>
  </ul>

  <c.Section title='Output Colorization'>

    Oddly enough, colorizing output in a terminal is a fairly complex process.  The standards are somewhat inconsistent and detection can be a tricky process. For terminals, {d.library('Node')} supports 4 different levels of coloring:

    <ul>
      <li>0 - One color, essentially uncolored output</li>
      <li>1 - Basic color support, 16 colors</li>
      <li>2 - Enhanced color support, 225 colors, providing a fair representation of most colors</li>
      <li>3 - True color, 24bit color with R, G, B each getting 8-bits.  Can represent any color needed</li>
    </ul>

    This module provides the ability to define color palettes using RGB or <c.CodeLink title='named colors' src='./src/named-colors.ts' startRe={/./} /> modeled after the standard HTML color names.  The module also provides the ability to specify palettes based on a dark or light background for a given terminal.  Support for this is widespread, but when it fails, it will gracefully assume a dark background. <br />

    These palettes then are usable at runtime, with the module determine light or dark palettes, as well as falling back to the closest color value based on what the existing terminal supports.  This means a color like 'olivegreen', will get the proper output in 24bit color support, a close approximation in enhanced color support, fall back to green in basic color support, and will be color less at level 0.

    <c.Code title='CLI Color Palette' src='@travetto/cli/src/color.ts' />

    When the color palette is combined with {d.mod('Base')}'s Util.makeTemplate, you produce a string template function that will automatically colorize:

    <c.Code title='Sample Template Usage'
      // eslint-disable-next-line no-template-curly-in-string
      src='cliTpl`Build finished: status=${{success: "complete"}}, output=${{path: "/build.zip"}}`'
    />

    This would then produce colorized output based on the palette, and the terminal capabilities. <br />

    This module follows the pattern {d.library('Node')} follows with respect to the environment variables: {d.field('NO_COLOR')}, {d.field('FORCE_COLOR')} and {d.field('NODE_DISABLE_COLORS')}

    <c.Execution title='Node help on colors' cmd={process.argv0} args={['-h']} config={{
      filter: line => /color/i.test(line),
      formatCommand: (cmd, args) => `node ${args.join(' ')} | grep -i color`
    }} />
  </c.Section>
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