/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Injectable } from '@travetto/di';
import { FileModelService, MemoryModelService } from '@travetto/model';
import { Links } from '@travetto/model/support/doc.support';
import { AssetService } from '@travetto/asset';

const Asset = d.codeLink('Asset', '@travetto/asset/src/types.ts', /interface Asset/);

export const text = <>
  <c.StdHeader />
  The asset module requires an {Links.Stream} to provide functionality for reading and writing streams. You can use any existing providers to serve as your {Links.Stream}, or you can roll your own.

  <c.Install title='provider' pkg='@travetto/model-{provider}' />

  Currently, the following are packages that provide {Links.Stream} support:
  <ul>
    <li>{d.mod('Model')} - {FileModelService}, {MemoryModelService}</li>
    <li>{d.mod('ModelMongo')}</li>
    <li>{d.mod('ModelS3')}</li>
  </ul>

  If you are using more than one {Links.Stream} service, you will need to declare which one is intended to be used by the asset service.  This can be accomplished by:

  <c.Code title='Configuration Methods' src='doc/asset-config.ts' />

  Reading of and writing assets uses the {AssetService}.  Below you can see an example dealing with a user's profile image.

  <c.Code title='User Profile Images' src='doc/user-profile.ts' />

  <c.Section title='Naming Strategies'>

    By default, the assets are stored by path, as specified in the {Asset} object.  This is standard, and expected, but some finer control may be desired.  In addition to standard naming, the module also supports naming by hash, to prevent duplicate storage of the same files with different hashes. This is generally useful when surfacing a lot of public (within the application) user-generated content. <br />

    The underlying contract for a <c.CodeLink title='AssetNamingStrategy' src='@travetto/asset/src/naming.ts' startRe={/interface AssetNamingStrategy/} /> looks like:

    <c.Code title='AssetNamingStrategy' src='@travetto/asset/src/naming.ts' startRe={/interface AssetNamingStrategy/} endRe={/^[}]/} />

    By extending this, and making it {Injectable}, the naming strategy will become the default for the system.
  </c.Section>
  <c.Section title='Advanced Usage' >

    In addition to reading and writing, you can also retrieve information on the saved asset, including basic information, and additional meta data.  The structure of the {Asset} looks like:

    <c.Code title='Asset Structure' src='@travetto/asset/src/types.ts' />

    To get the asset information, you would call:

    <c.Code title='Fetching Asset Info' src='doc/user-profile-meta.ts' />
  </c.Section>
</>;