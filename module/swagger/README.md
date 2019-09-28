travetto: Swagger
===

**Install: primary**
```bash
$ npm install @travetto/swagger
```

In the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module, the controllers and endpoints can be described via decorators, comments, or typings. This only provides the general metadata internally. This is not sufficient to generate a usable API doc, and so this module exists to bridge that gap.

The module is provides a [`swagger`](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swaggerObject) v2 representation of the API metadata provided via the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) and [`Schema`](https://github.com/travetto/travetto/tree/master/module/schema) modules.


## Configuration
By installing the dependency, the [`swagger`](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swaggerObject) endpoint is automatically generated and exposed at the root of the application as `/swagger.json`.  

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
swagger:
  output?: Spec output directory
```

## Spec Generation
The framework, when in watch mode, will generate the [`swagger`](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swaggerObject) JSON file. This module integrates with the file watching paradigm and can regenerate the swagger json as changes to endpoints and models are made during development.

## Client Generation
The outputted spec can be 