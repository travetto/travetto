/** @jsxImportSource @travetto/doc */
import { d, c, DocJSXElementByFn, DocJSXElement, DocFileUtil } from '@travetto/doc';
import { Config } from '@travetto/config';

export const Links = {
  Basic: d.codeLink('Basic', '@travetto/model/src/types/basic.ts', /export interface/),
  Crud: d.codeLink('CRUD', '@travetto/model/src/types/crud.ts', /export interface/),
  Expiry: d.codeLink('Expiry', '@travetto/model/src/types/expiry.ts', /export interface/),
  Indexed: d.codeLink('Indexed', '@travetto/model/src/types/indexed.ts', /export interface/),
  Bulk: d.codeLink('Bulk', '@travetto/model/src/types/bulk.ts', /export interface/),
  Blob: d.codeLink('Blob', '@travetto/model/src/types/blob.ts', /export interface/),
};

export const ModelTypes = (fn: | Function): DocJSXElement[] => {
  const { content } = DocFileUtil.readSource(fn);
  const found: DocJSXElementByFn<'CodeLink'>[] = [];
  const seen = new Set();
  for (const [, key] of content.matchAll(/Model(Crud|Expiry|Indexed|Bulk|Blob)Support/g)) {
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