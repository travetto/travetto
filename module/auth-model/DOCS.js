const { doc: d, Mod, Code, SnippetLink, Section, Snippet } = require('@travetto/doc');

exports.text = d`

This module provides the integration between the ${Mod('auth')} module and the ${Mod('model')}.

The module itself is fairly straightforward, and truly the only integration point for this module to work is defined at the model level.  The contract for authentication is established in code as providing translation to and from a ${SnippetLink('RegisteredIdentity', './src/identity.ts', /interface RegisteredIdentity/)}

A registered identity extends the base concept of an identity, by adding in additional fields needed for local registration, specifically password management information.

${Snippet('Registered Identity', './src/identity.ts', /interface RegisteredIdentity/, /^[}]/)}

${Code('A valid user model', 'doc/model.ts')}

${Section('Configuration')}

Additionally, there exists a common practice of mapping various external security principals into a local contract. These external identities, as provided from countless authentication schemes, need to be homogeonized for use.  This has been handled in other frameworks by using external configuration, and creating a mapping between the two set of fields.  Within this module, the mappings are defined as functions in which you can translate to the model from an identity or to an identity from a model.

${Code('Principal Source configuration', 'doc/config.ts')}

${Code('Sample usage', 'doc/usage.ts')}
`;