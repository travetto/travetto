/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { YamlUtil } from './src/util';

export const text = <>
  <c.StdHeader />
  In the desire to provide a minimal footprint, the framework provides a minimal {d.library('YAML')} parser/serializer to handle standard configuration structure. <br />

  {YamlUtil} is the main access point for this module, and will expose two method, {d.method('parse')} and {d.method('serialize')}.

  <c.Code title='Simple YAML Parsing' src='doc/parse.ts' />
  <c.Execution title='Simple YAML Parsing' cmd='trv' args={['main', 'doc/parse.ts']} />

  <c.Code title='Simple YAML Serialization' src='doc/serialize.ts' />
  <c.Execution title='Simple YAML Serialization' cmd='trv' args={['main', 'doc/serialize.ts']} />
</>;