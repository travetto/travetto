/** @jsxImportSource @travetto/doc */
import { readFileSync } from 'node:fs';

import { RuntimeIndex } from '@travetto/manifest';
import { d, c, DocJSXElementByFn, DocJSXElement } from '@travetto/doc';
import { Config } from '@travetto/config';

export const Links = {
  Basic: d.codeLink('Basic', '@travetto/model/src/service/basic.ts', /export interface/),
  Crud: d.codeLink('CRUD', '@travetto/model/src/service/crud.ts', /export interface/),
  Expiry: d.codeLink('Expiry', '@travetto/model/src/service/expiry.ts', /export interface/),
  Indexed: d.codeLink('Indexed', '@travetto/model/src/service/indexed.ts', /export interface/),
  Bulk: d.codeLink('Bulk', '@travetto/model/src/service/bulk.ts', /export interface/),
  Stream: d.codeLink('Streaming', '@travetto/model/src/service/stream.ts', /export interface/),
};

export const ModelTypes = (file: string | Function): DocJSXElement[] => {
  if (typeof file !== 'string') {
    file = RuntimeIndex.getFunctionMetadata(file)!.source;
  }
  const contents = readFileSync(file, 'utf8');
  const found: DocJSXElementByFn<'CodeLink'>[] = [];
  const seen = new Set();
  for (const [, key] of contents.matchAll(/Model(Crud|Expiry|Indexed|Bulk|Stream)Support/g)) {
    if (!seen.has(key)) {
      seen.add(key);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      found.push(Links[key as keyof typeof Links]);
    }
  }
  return found.map(v => <li>{v}</li>);
};

export const ModelCustomConfig = ({ cfg }: { cfg: Function }): DocJSXElement => <>
  Out of the box, by installing the module, everything should be wired up by default.If you need to customize any aspect of the source
  or config, you can override and register it with the {d.mod('Di')} module.

  <c.Code title='Wiring up a custom Model Source' src='doc/custom-service.ts' />

  where the {cfg} is defined by:

  <c.Code title={`Structure of ${cfg.name}`} src={cfg} />

  Additionally, you can see that the class is registered with the {Config} annotation, and so these values can be overridden using the
  standard {d.mod('Config')}resolution paths.
</>;