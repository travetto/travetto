import { d, mod } from '@travetto/doc';

export const text = d`
${d.Header()}

Sample documentation for fictional module.  This module fictitiously relies upon ${mod.Cache} functionality.

${d.Ordered(
  'First',
  'Second',
  d.Path('Special')
)}

${d.Section('Content')}

${d.Code('Document Sample', 'docs/test.ts')}

${d.SubSection('Output')}

${d.Execute('Run program', 'trv')}
`;