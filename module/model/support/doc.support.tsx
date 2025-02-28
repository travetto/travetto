/** @jsxImportSource @travetto/doc */
import { d, c, DocJSXElementByFn, DocJSXElement, DocFileUtil } from '@travetto/doc';
import { Config } from '@travetto/config';
import { Runtime, toConcrete } from '@travetto/runtime';
import { ModelBasicSupport, ModelBlobSupport, ModelBulkSupport, ModelCrudSupport, ModelExpirySupport, ModelIndexedSupport } from '../__index__';

const toLink = (title: string, target: Function): DocJSXElementByFn<'CodeLink'> =>
  d.codeLink(title, Runtime.getSourceFile(target), new RegExp(`\\binterface\\s+${target.name}`));

export const Links = {
  Basic: toLink('Basic', toConcrete<ModelBasicSupport>()),
  Crud: toLink('CRUD', toConcrete<ModelCrudSupport>()),
  Expiry: toLink('Expiry', toConcrete<ModelExpirySupport>()),
  Indexed: toLink('Indexed', toConcrete<ModelIndexedSupport>()),
  Bulk: toLink('Bulk', toConcrete<ModelBulkSupport>()),
  Blob: toLink('Blob', toConcrete<ModelBlobSupport>()),
};

export const ModelTypes = (fn: | Function): DocJSXElement[] => {
  const { content } = DocFileUtil.readSource(fn);
  const found: DocJSXElementByFn<'CodeLink'>[] = [];
  const seen = new Set<string>();
  for (const [, key] of content.matchAll(/Model([A-Za-z]+)Support/g)) {
    if (!seen.has(key) && key in Links) {
      seen.add(key);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const link = Links[key as keyof typeof Links];
      found.push(link);
    }
  }
  return found.map(v => <li>{v}</li>);
};

export const ModelCustomConfig = ({ cfg }: { cfg: Function }): DocJSXElement => <>
  Out of the box, by installing the module, everything should be wired up by default.If you need to customize any aspect of the source
  or config, you can override and register it with the {d.mod('Di')} module.

  <c.Code title='Wiring up a custom Model Source' src='doc/custom-service.ts' />

  where the {cfg} is defined by:

  <c.Code title={`Structure of ${cfg.name}`} src={cfg} startRe={/./} />

  Additionally, you can see that the class is registered with the {Config} annotation, and so these values can be overridden using the
  standard {d.mod('Config')}resolution paths.
</>;