import { Util } from '@travetto/base';
import { ColorOutputUtil } from '@travetto/terminal';

const tplFn = ColorOutputUtil.templateFunction({
  input: 'oliveDrab',
  output: 'pink',
  path: 'teal',
  success: 'green',
  failure: 'red',
  param: ['yellow', 'goldenrod'],
  type: 'cyan',
  description: ['white', 'gray'],
  title: ['brightWhite', 'black'],
  identifier: 'dodgerBlue',
  subtitle: ['lightGray', 'darkGray'],
  subsubtitle: 'darkGray'
});

export const cliTpl = Util.makeTemplate(tplFn);