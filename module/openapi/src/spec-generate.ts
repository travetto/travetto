import { Readable } from 'node:stream';
import type {
  SchemaObject, SchemasObject, ParameterObject, OperationObject,
  RequestBodyObject, TagObject, PathsObject, PathItemObject
} from 'openapi3-ts/oas31';

import { EndpointConfig, ControllerConfig, EndpointParamConfig, EndpointIOType, ControllerVisitor, HTTP_METHODS } from '@travetto/web';
import { Class, describeFunction } from '@travetto/runtime';
import { SchemaRegistry, FieldConfig, ClassConfig, SchemaNameResolver, InputConfig, SchemaRegistryIndex } from '@travetto/schema';
import { RegistryV2 } from '@travetto/registry';

import { ApiSpecConfig } from './config.ts';

const DEFINITION = '#/components/schemas';

function isInputConfig(val: object): val is InputConfig {
  return !!val && 'owner' in val && 'type' in val;
}

function isFieldConfig(val: object): val is FieldConfig {
  return isInputConfig(val) && 'name' in val;
}

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
  #schemaToDotParams(location: 'query' | 'header', input: InputConfig, prefix: string = '', rootField: InputConfig = input): ParameterObject[] {
    const viewConf = RegistryV2.has(SchemaRegistryIndex, input.type) &&
      RegistryV2.get(SchemaRegistryIndex, input.type).getView(input.view);

    const schemaConf = viewConf && viewConf.schema;
    if (!schemaConf) {
      throw new Error(`Unknown class, not registered as a schema: ${input.type.Ⲑid}`);
    }

    const params: ParameterObject[] = [];
    for (const sub of Object.values(schemaConf)) {
      if (SchemaRegistry.has(sub.type) || SchemaRegistry.hasPending(sub.type)) {
        const suffix = (sub.array) ? '[]' : '';
        params.push(...this.#schemaToDotParams(location, sub, prefix ? `${prefix}.${sub.name}${suffix}` : `${sub.name}${suffix}.`, rootField));
      } else {
        params.push({
          name: `${prefix}${sub.name}`,
          description: sub.description,
          schema: sub.array ? {
            type: 'array',
            ...this.#getType(sub)
          } : this.#getType(sub),
          required: !!(rootField?.required?.active && sub.required?.active),
          in: location
        });
      }
    }
    return params;
  }

  /**
   * Get the type for a given class
   */
  #getType(inputOrClass: InputConfig | Class): Record<string, unknown> {
    let field: { type: Class<unknown>, precision?: [number, number | undefined] };
    if (!isInputConfig(inputOrClass)) {
      field = { type: inputOrClass };
    } else {
      field = inputOrClass;
    }
    const out: Record<string, unknown> = {};
    // Handle nested types
    if (SchemaRegistry.has(field.type)) {
      const id = this.#nameResolver.getName(SchemaRegistry.get(field.type));
      // Exposing
      this.#schemas[id] = this.#allSchemas[id];
      out.$ref = `${DEFINITION}/${id}`;
    } else {
      switch (field.type) {
        case String: out.type = 'string'; break;
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
  #processSchemaField(input: InputConfig, required: string[]): SchemaObject {
    let prop: SchemaObject = this.#getType(input);

    if (input.examples) {
      prop.example = input.examples;
    }
    prop.description = input.description;
    if (input.match) {
      prop.pattern = input.match.re!.source;
    }
    if (input.maxlength) {
      prop.maxLength = input.maxlength.n;
    }
    if (input.minlength) {
      prop.minLength = input.minlength.n;
    }
    if (input.min) {
      prop.minimum = typeof input.min.n === 'number' ? input.min.n : input.min.n.getTime();
    }
    if (input.max) {
      prop.maximum = typeof input.max.n === 'number' ? input.max.n : input.max.n.getTime();
    }
    if (input.enum) {
      prop.enum = input.enum.values;
    }
    if (isFieldConfig(input)) {
      if (input.required && input.required.active) {
        required.push(input.name.toString());
      }
      if (input.access === 'readonly') {
        prop.readOnly = true;
      } else if (input.access === 'writeonly') {
        prop.writeOnly = true;
      }
    }
    if (input.array) {
      prop = {
        type: 'array',
        items: prop
      };
    }

    return prop;
  }

  /**
   * Process schema class
   */
  onSchema(type?: ClassConfig): void {
    if (type === undefined) {
      return;
    }

    const cls = type.class;
    const typeId = this.#nameResolver.getName(type);

    if (!this.#allSchemas[typeId]) {
      const config = SchemaRegistry.get(cls);
      if (config) {
        this.#allSchemas[typeId] = {
          title: config.title || config.description,
          description: config.description || config.title,
          example: config.examples
        };

        const properties: Record<string, SchemaObject> = {};
        const def = config;
        const required: string[] = [];

        for (const fieldName of Object.keys(def.fields)) {
          if (SchemaRegistry.has(def.fields[fieldName].type)) {
            this.onSchema(SchemaRegistry.get(def.fields[fieldName].type));
          }
          properties[fieldName] = this.#processSchemaField(def.fields[fieldName], required);
        }

        const extra: Record<string, unknown> = {};
        if (describeFunction(cls)?.abstract) {
          const map = SchemaRegistry.getSubTypesForClass(cls);
          if (map) {
            extra.oneOf = map
              .filter(x => !describeFunction(x)?.abstract)
              .map(c => {
                this.onSchema(SchemaRegistry.get(c));
                return this.#getType(c);
              });
          }
        }

        Object.assign(this.#allSchemas[typeId], {
          properties,
          ...(required.length ? { required } : {}),
          ...extra
        });
      } else {
        this.#allSchemas[typeId] = { title: typeId };
      }
    }
  }

  /**
   * Standard payload structure
   */
  #getEndpointBody(body?: EndpointIOType, mime?: string | null): RequestBodyObject {
    if (!body) {
      return { content: {}, description: '' };
    } else if (body.type === Readable || body.type === Buffer) {
      return {
        content: {
          [mime ?? 'application/octet-stream']: { schema: { type: 'string', format: 'binary' } }
        },
        description: ''
      };
    } else {
      const cls = SchemaRegistry.get(body.type);
      const typeId = cls ? this.#nameResolver.getName(cls) : body.type.name;
      const typeRef = cls ? this.#getType(body.type) : { type: body.type.name.toLowerCase() };
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
  #processEndpointParam(ep: EndpointConfig, param: EndpointParamConfig, input: InputConfig): (
    { requestBody: RequestBodyObject } |
    { parameters: ParameterObject[] } |
    undefined
  ) {
    const complex = input.type && SchemaRegistry.has(input.type);
    if (param.location) {
      if (param.location === 'body') {
        const acceptsMime = ep.finalizedResponseHeaders.get('accepts');
        return {
          requestBody: input.specifiers?.includes('file') ? this.#buildUploadBody() : this.#getEndpointBody(input, acceptsMime)
        };
      } else if (complex && (param.location === 'query' || param.location === 'header')) {
        return { parameters: this.#schemaToDotParams(param.location, input, param.prefix ? `${param.prefix}.` : '') };
      } else {
        const epParam: ParameterObject = {
          in: param.location,
          name: param.name || param.location,
          description: input.description,
          required: !!input.required?.active || false,
          schema: input.array ? { type: 'array', items: this.#getType(input) } : this.#getType(input)
        };
        return { parameters: [epParam] };
      }
    }
  }

  /**
   * Process controller endpoint
   */
  onEndpointEnd(ep: EndpointConfig, ctrl: ControllerConfig): void {
    if (this.#config.skipEndpoints || !ep.httpMethod) {
      return;
    }

    const tagName = ctrl.externalName;

    const op: OperationObject = {
      tags: [tagName],
      responses: {},
      summary: ep.title,
      description: ep.description || ep.title,
      operationId: `${ep.class.name}_${ep.name}`,
      parameters: []
    };

    const contentTypeMime = ep.finalizedResponseHeaders.get('content-type');
    const pConf = this.#getEndpointBody(ep.responseType, contentTypeMime);
    const code = Object.keys(pConf.content).length ? 200 : 201;
    op.responses![code] = pConf;

    const schema = RegistryV2.get(SchemaRegistryIndex, ep.class).getMethod(ep.name);
    for (const param of schema.parameters) {
      const result = this.#processEndpointParam(ep, ep.params[param.index], param);
      if (result) {
        if ('parameters' in result) {
          (op.parameters ??= []).push(...result.parameters);
        } else {
          op.requestBody ??= result.requestBody;
        }
      }
    }

    const key = ep.fullPath.replace(/:([A-Za-z0-9_]+)\b/g, (__, param) => `{${param}}`);

    this.#paths[key] = {
      ...(this.#paths[key] ?? {}),
      [HTTP_METHODS[ep.httpMethod].lower]: op
    };
  }

  onControllerEnd(controller: ControllerConfig): void {
    if (this.#config.skipEndpoints) {
      return;
    }
    this.#tags.push({
      name: controller.externalName,
      description: controller.description || controller.title
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
          .map(([k, v]) => [k, Object.fromEntries(
            Object.entries(v)
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