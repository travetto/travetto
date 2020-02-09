travetto: OpenAPI
===

**Install: primary**
```bash
$ npm install @travetto/openapi
```

In the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module, the controllers and endpoints can be described via decorators, comments, or typings. This only provides the general metadata internally. This is not sufficient to generate a usable API doc, and so this module exists to bridge that gap.

The module is provides an [`OpenAPI`](https://github.com/OAI/OpenAPI-Specification) v3.0 representation of the API metadata provided via the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) and [`Schema`](https://github.com/travetto/travetto/tree/master/module/schema) modules.


## Configuration
By installing the dependency, the [`OpenAPI`](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md) endpoint is automatically generated and exposed at the root of the application as `/api.spec.yaml` (by default). 

All of the high level configurations can be found in the following structure:

**Config: Swagger configuration**
```yaml
api:
  info:
    contact:
      email: <email, default package.json#author/email>
      name: <name, default package.json#author/name>
    description: <desc, default package.json#description>
    license: <license, default package.json#license>
    termsOfService?: <tos>
    title: <title, default package.json#name>
    version: <version, default package.json#version>
  host:
    basePath: <basePath, defaults to '/'>
    host?: <host name>
    swagger: <swagger version, only 2.0 is supported>
  spec:
    exposeAllSchemas: <determines if all schemas should be exported, even if unused>
    output?: <Spec output directory>
```

## Spec Generation
The framework, when in watch mode, will generate the [`OpenAPI`](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md) specification in either JSON or YAML. This module integrates with the file watching paradigm and can regenerate the openapi spec as changes to endpoints and models are made during development.  The output format is defined by the suffix of the output file, `.yaml` or `.json`

## Client Generation
The outputted spec can be consumed using the [`OpenAPI client generation tools`](https://github.com/OpenAPITools/openapi-generator).