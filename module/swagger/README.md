travetto: Swagger
===
The module is provides a [`swagger`](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swaggerObject) v2 representation of the API metadata provided via the [`Express`](https://github.com/travetto/travetto/tree/master/module/express) and [`Schema`](https://github.com/travetto/travetto/tree/master/module/schema) modules.


## Configuration
By installing the dependency, the [`swagger`](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swaggerObject) endpoint is automatically generated and exposed at the root of the application as `/swagger.json`.  

All of the high level configurations can be found in the following structure:

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
  client:
    codeGenImage: swaggerapi/swagger-codegen-cli
    output?: Codegen ouptut directory
    format?: Codegen language format
    formatOptions?: Options to pass to the codegen tool
```

## Client Generation
In addition to the [`swagger`](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swaggerObject) JSON file generation, the module also supports generating a client output as the schema changes.  