import chalk from 'chalk';

import { ColorUtil } from '@travetto/base';

export const cliTpl = ColorUtil.makeTemplate({
  input: chalk.hex('#6b8e23'), // Olive drab
  output: chalk.hex('#ffc0cb'), // Pink
  path: chalk.hex('#008080'), // Teal
  success: chalk.hex('#00ff00'), // Green
  failure: chalk.hex('#ff0000'), // Red
  param: [chalk.hex('#ffff00'), chalk.hex('#daa520')], // Yellow / Goldenrod
  type: chalk.hex('#00ffff'), // Teal
  description: [chalk.hex('#ffffff'), chalk.hex('#808080')], // White / Gray
  title: [chalk.whiteBright, chalk.black], // Bright white / black
  identifier: chalk.hex('#1e90ff'), // Dodger blue
  subtitle: [chalk.hex('#d3d3d3'), chalk.hex('#a9a9a9')], // Light gray / Dark Gray
  subsubtitle: chalk.hex('#a9a9a9') // Dark gray
});