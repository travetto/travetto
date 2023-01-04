import { Util } from '@travetto/base';
import { ColorOutputUtil } from '@travetto/terminal';

const tplFn = ColorOutputUtil.templateFunction({
  input: 'oliveDrab',
  output: 'pink',
  path: 'teal',
  success: 'green',
  failure: 'red',
  param: 'yellow',
  type: 'cyan',
  description: 'white',
  title: 'brightWhite',
  identifier: 'dodgerBlue',
  subtitle: 'lightGray',
  subsubtitle: 'darkGray'
});

export const cliTpl = Util.makeTemplate(tplFn);