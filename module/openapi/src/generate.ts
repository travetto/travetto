import type {
  SchemaObject, SchemasObject, ParameterObject, OperationObject,
  RequestBodyObject, TagObject, PathsObject, PathItemObject
} from 'openapi3-ts/oas31';

import { type EndpointConfig, type ControllerConfig, type EndpointParameterConfig, type ControllerVisitor, HTTP_METHODS } from '@travetto/web';
import { AppError, castTo, type Class, describeFunction } from '@travetto/runtime';
import {
  type SchemaFieldConfig, type SchemaClassConfig, SchemaNameResolver,
  type SchemaInputConfig, SchemaRegistryIndex, type SchemaBasicType, type SchemaParameterConfig
} from '@travetto/schema';

import type { ApiSpecConfig } from './config.ts';

const DEFINITION = '#/components/schemas';

const isInputConfig = (value: object): value is SchemaInputConfig => !!value && 'class' in value && 'type' in value;
const isFieldConfig = (value: object): value is SchemaFieldConfig => isInputConfig(value) && 'name' in value;

type GeneratedSpec = {
  tags: TagObject[];
  paths: Record<string, PathItemObject>;
  components: {
    schemas: SchemasObject;
  };
};

/**
 * Spec generation utilities
 */
export class OpenapiVisitor implements ControllerVisitor<GeneratedSpec> {
  #tags: TagObject[] = [];
  #allSchemas: SchemasObject = {};
  #schemas: SchemasObject = {};
  #paths: PathsObject = {};

  #config: Partial<ApiSpecConfig> = {};

  #nameResolver = new SchemaNameResolver();

  constructor(config: Partial<ApiSpecConfig> = {}) {
    this.#config = config;
  }

  /**
   * Convert schema to a set of dotted parameters
   */
  #schemaToDotParams(location: 'query' | 'header', input: SchemaInputConfig, prefix: string = '', rootField: SchemaInputConfig = input): ParameterObject[] {
    if (!SchemaRegistryIndex.has(input.type)) {
      throw new AppError(`Unknown class, not registered as a schema: ${input.type.Ⲑid}`);
    }

    const fields = SchemaRegistryIndex.get(input.type).getFields(input.view);
    const params: ParameterObject[] = [];
    for (const sub of Object.values(fields)) {
      const name = sub.name;
      if (SchemaRegistryIndex.has(sub.type)) {
        const suffix = (sub.array) ? '[]' : '';
        params.push(...this.#schemaToDotParams(location, sub, prefix ? `${prefix}.${name}${suffix}` : `${name}${suffix}.`, rootField));
      } else {
        params.push({
          name: `${prefix}${name}`,
          description: sub.description,
          schema: sub.array ? {
            type: 'array',
            ...this.#getType(sub)
          } : this.#getType(sub),
          required: (rootField?.required?.active !== false && sub.required?.active !== false),
          in: location
        });
      }
    }
    return params;
  }

  /**
   * Get the type for a given class
   */
  #getType(inputOrClass: SchemaInputConfig | Class): Record<string, unknown> {
    let field: { type: Class, precision?: [number, number | undefined] };
    if (!isInputConfig(inputOrClass)) {
      field = { type: inputOrClass };
    } else {
      field = inputOrClass;
    }
    const out: Record<string, unknown> = {};
    // Handle nested types
    if (SchemaRegistryIndex.has(field.type)) {
      const id = this.#nameResolver.getName(SchemaRegistryIndex.getConfig(field.type));
      // Exposing
      this.#schemas[id] = this.#allSchemas[id];
      out.$ref = `${DEFINITION}/${id}`;
    } else {
      switch (field.type) {
        case String: out.type = 'string'; break;
        case castTo(BigInt):
          out.type = 'integer';
          out.format = 'int64';
          break;
        case Number: {
          if (field.precision) {
            const [, decimals] = field.precision;
            out.type = !decimals ? 'integer' : 'number';
          } else {
            out.type = 'number';
          }
          break;
        }
        case Date:
          out.format = 'date-time';
          out.type = 'string';
          break;
        case Boolean: out.type = 'boolean'; break;
        default:
          out.type = 'object';
          break;
      }
    }
    return out;
  }

  /**
   * Get upload body
   */
  #buildUploadBody(): RequestBodyObject {
    return {
      description: 'Uploaded files',
      content: {
        'multipart/form-data': {
          schema: { properties: { file: { type: 'array', items: { type: 'string', format: 'binary' } } } }
        }
      }
    };
  }

  /**
   * Process schema field
   */
  #processSchemaField(input: SchemaInputConfig, required: string[]): SchemaObject {
    let config: SchemaObject = this.#getType(input);

    if (input.examples) {
      config.example = input.examples;
    }
    config.description = input.description;
    if (input.match) {
      config.pattern = input.match.regex!.source;
    }
    if (input.maxlength) {
      config.maxLength = input.maxlength.limit;
    }
    if (input.minlength) {
      config.minLength = input.minlength.limit;
    }
    if (input.min) {
      config.minimum = input.min.limit instanceof Date ? input.min.limit.getTime() : castTo(input.min.limit);
    }
    if (input.max) {
      config.maximum = input.max.limit instanceof Date ? input.max.limit.getTime() : castTo(input.max.limit);
    }
    if (input.enum) {
      config.enum = input.enum.values;
    }
    if (isFieldConfig(input)) {
      if (input.required?.active !== false) {
        required.push(input.name);
      }
      if (input.access === 'readonly') {
        config.readOnly = true;
      } else if (input.access === 'writeonly') {
        config.writeOnly = true;
      }
    }
    if (input.array) {
      config = {
        type: 'array',
        items: config
      };
    }

    return config;
  }

  /**
   * Process schema class
   */
  onSchema(type?: SchemaClassConfig): void {
    if (type === undefined) {
      return;
    }

    const cls = type.class;
    const typeId = this.#nameResolver.getName(type);

    if (!this.#allSchemas[typeId]) {
      const config = SchemaRegistryIndex.getConfig(cls);
      if (config) {
        this.#allSchemas[typeId] = {
          description: config.description,
          examples: config.examples
        };

        const properties: Record<string, SchemaObject> = {};
        const base = config;
        const required: string[] = [];

        for (const fieldName of Object.keys(base.fields)) {
          if (SchemaRegistryIndex.has(base.fields[fieldName].type)) {
            this.onSchema(SchemaRegistryIndex.getConfig(base.fields[fieldName].type));
          }
          properties[fieldName] = this.#processSchemaField(base.fields[fieldName], required);
        }

        const extra: Record<string, unknown> = {};
        if (config.discriminatedBase) {
          const subClasses = SchemaRegistryIndex.getDiscriminatedClasses(cls);
          if (subClasses) {
            extra.oneOf = subClasses
              .filter(subCls => !describeFunction(subCls)?.abstract)
              .map(subCls => {
                this.onSchema(SchemaRegistryIndex.getConfig(subCls));
                return this.#getType(subCls);
              });
          }
        }

        Object.assign(this.#allSchemas[typeId], {
          properties,
          ...(required.length ? { required } : {}),
          ...extra
        });
      } else {
        this.#allSchemas[typeId] = { description: typeId };
      }
    }
  }

  /**
   * Standard payload structure
   */
  #getEndpointBody(body?: SchemaBasicType, mime?: string | null): RequestBodyObject {
    if (!body || body.type === undefined) {
      return { content: {}, description: '' };
    } else if (body.binary) {
      return {
        content: {
          [mime ?? 'application/octet-stream']: { schema: { type: 'string', format: 'binary' } },
        },
        description: 'Raw binary data'
      };
    } else {
      const schemaConfig = SchemaRegistryIndex.getOptional(body.type)?.get();
      const typeId = schemaConfig ? this.#nameResolver.getName(schemaConfig) : body.type.name;
      const typeRef = schemaConfig ? this.#getType(body.type) : { type: body.type.name.toLowerCase() };
      return {
        content: {
          [mime ?? 'application/json']: {
            schema: !body!.array ? typeRef : { type: 'array', items: typeRef }
          }
        },
        description: this.#allSchemas[typeId!]?.description ?? ''
      };
    }
  }

  /**
   * Process endpoint parameter
   */
  #processEndpointParam(endpoint: EndpointConfig, param: EndpointParameterConfig, input: SchemaParameterConfig): (
    { requestBody: RequestBodyObject } |
    { parameters: ParameterObject[] } |
    undefined
  ) {
    const complex = input.type && SchemaRegistryIndex.has(input.type);

    if (param.location) {
      if (param.location === 'body') {
        const acceptsMime = endpoint.finalizedResponseHeaders.get('accepts');
        return {
          requestBody: input.specifiers?.includes('file') ? this.#buildUploadBody() : this.#getEndpointBody(input, acceptsMime)
        };
      } else if (complex && (param.location === 'query' || param.location === 'header')) {
        return { parameters: this.#schemaToDotParams(param.location, input, param.prefix ? `${param.prefix}.` : '') };
      } else {
        const epParam: ParameterObject = {
          in: param.location,
          name: input.name ?? param.location,
          description: input.description,
          required: input.required?.active !== false,
          schema: input.array ? { type: 'array', items: this.#getType(input) } : this.#getType(input)
        };
        return { parameters: [epParam] };
      }
    }
  }

  /**
   * Process controller endpoint
   */
  onEndpointEnd(endpoint: EndpointConfig, controller: ControllerConfig): void {
    if (this.#config.skipEndpoints || !endpoint.httpMethod) {
      return;
    }

    const tagName = controller.externalName;

    const schema = SchemaRegistryIndex.get(endpoint.class).getMethod(endpoint.methodName);

    const apiConfig: OperationObject = {
      tags: [tagName],
      responses: {},
      summary: schema.description,
      description: schema.description,
      operationId: `${endpoint.class.name}_${endpoint.methodName}`,
      parameters: []
    };

    const contentTypeMime = endpoint.finalizedResponseHeaders.get('content-type');
    const bodyConfig = this.#getEndpointBody(schema.returnType, contentTypeMime);
    const code = Object.keys(bodyConfig.content).length ? 200 : 201;
    apiConfig.responses![code] = bodyConfig;

    for (const param of schema.parameters) {
      const result = this.#processEndpointParam(endpoint, endpoint.parameters[param.index] ?? {}, param);
      if (result) {
        if ('parameters' in result) {
          (apiConfig.parameters ??= []).push(...result.parameters);
        } else {
          apiConfig.requestBody ??= result.requestBody;
        }
      }
    }

    const key = endpoint.fullPath.replace(/:([A-Za-z0-9_]+)\b/g, (__, param) => `{${param}}`);

    this.#paths[key] = {
      ...(this.#paths[key] ?? {}),
      [HTTP_METHODS[endpoint.httpMethod].lower]: apiConfig
    };
  }

  onControllerEnd(controller: ControllerConfig): void {
    if (this.#config.skipEndpoints) {
      return;
    }
    const classSchema = SchemaRegistryIndex.getConfig(controller.class);
    this.#tags.push({
      name: controller.externalName,
      description: classSchema.description
    });
  }

  onComplete(): GeneratedSpec {
    if (this.#config.exposeAllSchemas) {
      this.#schemas = this.#allSchemas;
    }

    return {
      tags: this.#tags.toSorted((a, b) => a.name.localeCompare(b.name)),
      paths: Object.fromEntries(
        Object.entries(this.#paths)
          .toSorted(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, Object.fromEntries(
            Object.entries(value)
              .toSorted(([a], [b]) => a.localeCompare(b))
          )])
      ),
      components: {
        schemas: Object.fromEntries(
          Object.entries(this.#schemas)
            .toSorted(([a], [b]) => a.localeCompare(b))
        )
      }
    };
  }
}