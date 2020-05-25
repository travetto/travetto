import { ColorUtil } from '@travetto/boot/src/color';

/**
 * Colorize a string, as a string interpolation
 *
 * @example
 * ```
 * color`${{title: 'Main Title'}} is ${{subtitle: 'Sub Title}}`
 * ```
 */
export const color = ColorUtil.makeTemplate({
  input: ColorUtil.makeColorer('yellow'),
  output: ColorUtil.makeColorer('magenta'),
  path: ColorUtil.makeColorer('cyan'),
  success: ColorUtil.makeColorer('green', 'bold'),
  failure: ColorUtil.makeColorer('red', 'bold'),
  param: ColorUtil.makeColorer('green', 'bold'),
  type: ColorUtil.makeColorer('blue', 'bold'),
  description: ColorUtil.makeColorer('white', 'faint', 'bold'),
  title: ColorUtil.makeColorer('white', 'bold'),
  identifier: ColorUtil.makeColorer('blue', 'bold'),
  subtitle: ColorUtil.makeColorer('white', 'faint')
});
