import { Util } from '@travetto/base';
import { GlobalOutput } from '@travetto/terminal';

const tplFn = GlobalOutput.templateFunction({
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