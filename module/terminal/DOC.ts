import { d, lib, mod } from '@travetto/doc';

export const text = () => d`
${d.Header()}

This module provides basic support for interacting with the terminal, and provides the basis for output colorization and the basic command line interactions.  The functionality can be broken down into: 

${d.List(
  'Output Colorization',
  'Terminal Interactions'
)}

${d.SubSection('Output Colorization')}

Oddly enough, colorizing output in a terminal is a fairly complex process.  The standards are somewhat inconsistent and detection can be a tricky process. For terminals, ${lib.Node} supports 4 different levels of coloring:
${d.List(
  '0 - One color, essentially uncolored output',
  '1 - Basic color support, 16 colors',
  '2 - Enhanced color support, 225 colors, providing a fair representation of most colors',
  '3 - True color, 24bit color with R, G, B each getting 8-bits.  Can represent any color needed'
)}

This module provides the ability to define color palettes using RGB or ${d.SnippetLink('named colors', './src/named-colors.ts', /./)} modeled after the standard HTML color names.  The module also provides the ability to specify palettes based on a dark or light background for a given terminal.  Support for this is widespread, but when it fails, it will gracefully assume a dark background. 

These palettes then are usable at runtime, with the module determine light or dark palettes, as well as falling back to the closest color value based on what the existing terminal supports.  This means a color like 'olivegreen', will get the proper output in 24bit color support, a close approximation in enhanced color support, fall back to green in basic color support, and will be color less at level 0.

${d.Code('CLI Color Palette', '@travetto/cli/src/color.ts')}

When the color palette is combined with ${mod.Base}'s Util.makeTemplate, you produce a string template function that will automatically colorize:

${d.Code('Sample Template Usage',
  // eslint-disable-next-line no-template-curly-in-string
  'cliTpl`Build finished: status=${{success: "complete"}}, output=${{path: "/build.zip"}}`'
)}

This would then produce colorized output based on the palette, and the terminal capabilities.

This module follows the pattern ${lib.Node} follows with respect to the environment variables: ${d.Field('NO_COLOR')}, ${d.Field('FORCE_COLOR')} and ${d.Field('NODE_DISABLE_COLORS')}

${d.Execute('Node help on colors', '/usr/bin/node', ['-h'], {
  filter: line => /color/i.test(line),
  formatCommand: (cmd, args) => `${cmd} ${args.join(' ')} | grep -i color`
})}

${d.SubSection('Terminal Interactions')}
Within the ${lib.Travetto} framework, there are plenty of command line interactions that are enhanced with additional interactivity.  This mainly revolves around indicating progress while a program is executing.  The module provides support for:

${d.List(
  'Progress Bars',
  'Waiting Indicators',
  'Streaming Content'
)}

This is generally meant for use within the framework, and so is highly tailored to the specific needs and scenarios.  You can see this pattern play out in the ${mod.Compiler} progress output, or in ${mod.Pack}'s output.

In these scenarios, the dynamic behaviors are dependent on having an interactive TTY.  When running without access to a proper stdin, the output will default to basic line printing.    This dynamic behavior can also be disabled using the environment variable ${d.Field('TRV_QUIET')}.  When set to ${d.Input('1')} will provide a minimal text-based experience.

`;