import { ControllerRegistry, MimeType } from '@travetto/express';
import { Class } from '@travetto/registry';
import { SchemaRegistry, DEFAULT_VIEW } from '@travetto/schema';

import { Spec, Parameter, Path, Response, Schema, Operation } from '../types';

const DEFINITION = '#/definitions';

export class SwaggerUtil {

  static getType(cls: Class, schemas: { [key: string]: Schema }) {
    const out: { [key: string]: any } = {};
    // Handle nested types
    if (SchemaRegistry.has(cls)) {
      out.$ref = `${DEFINITION}/${this.processSchema(cls, schemas)}`;
      out.type = 'object';
    } else {
      switch (cls) {
        case String: out.type = 'string'; break;
        case Number: out.type = 'number'; break;
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

  static processSchema(type: string | Class | undefined, schemas: { [key: string]: Schema }) {
    if (type === undefined || typeof type === 'string') {
      return undefined;
    } else {
      const typeId = type.name;

      if (!schemas[typeId]) {
        const config = SchemaRegistry.get(type);
        const properties: { [key: string]: Schema } = {};
        const def = config.views[DEFAULT_VIEW];
        const required = [];

        for (const fieldName of def.fields) {
          const field = def.schema[fieldName];
          let prop: Schema = this.getType(field.type, schemas);

          if (field.examples) {
            prop.example = field.examples;
          }
          prop.description = field.description;
          if (field.match) {
            prop.pattern = field.match.re!.source;
          }
          if (field.maxlength) {
            prop.maxLength = field.maxlength.n;
          }
          if (field.minlength) {
            prop.minLength = field.minlength.n;
          }
          if (field.min) {
            prop.minimum = field.min.n as number;
          }
          if (field.max) {
            prop.maximum = field.max.n as number;
          }
          if (field.enum) {
            prop.enum = field.enum.values;
          }
          if (field.required) {
            required.push(fieldName);
          }

          if (field.array) {
            prop = {
              type: 'array',
              items: prop
            };
          }

          properties[fieldName] = prop;
        }

        schemas[typeId] = {
          title: config.title || config.description,
          description: config.description || config.title,
          example: config.examples,
          properties,
          required
        };
      }
      return typeId;
    }
  }

  static generate(): Partial<Spec> {
    const paths: { [key: string]: Path } = {};
    const definitions: { [key: string]: Schema } = {};
    const tags: { name: string, description?: string }[] = [];

    for (const cls of ControllerRegistry.getClasses()) {
      const ctrl = ControllerRegistry.get(cls);
      const tagName = ctrl.class.name.replace(/(Rest|Controller)$/, '');

      tags.push({
        name: tagName,
        description: ctrl.description || ctrl.title
      });

      for (const ep of ctrl.endpoints) {

        const epParams: Parameter[] = [];
        const epProd = ep.responseType! || {};
        const epCons = ep.requestType! || {};
        const produces = [];
        const consumes = [];

        const epProduces = this.processSchema(epProd.type, definitions);
        const epConsumes = this.processSchema(epCons.type, definitions);
        const responses: { [key: string]: Response } = {};

        if (epProduces) {
          const ref: Schema = { $ref: `${DEFINITION}/${epProduces}` };
          responses[200] = {
            description: definitions[epProduces!].description || '',
            schema: epProd!.wrapper !== Array ? ref : { type: 'array', items: ref }
          };
          produces.push(MimeType.JSON);
        } else {
          responses[201] = {
            description: ''
          };
        }

        if (epConsumes) {
          const ref: Schema = { $ref: `${DEFINITION}/${epConsumes}` };
          epParams.push({
            in: 'body',
            name: 'body',
            description: definitions[epConsumes!].description || '',
            schema: epCons!.wrapper !== Array ? ref : { type: 'array', items: ref }
          } as Parameter);
          consumes.push(MimeType.JSON);
        }

        for (const param of Object.values(ep.params)) {
          const epParam: Parameter = {
            in: param.location,
            name: param.name,
            description: param.description,
            required: !!param.required,
          };
          if (param.type) {
            const type = this.getType(param.type!, definitions);
            if (type.$ref) {
              // Not supported yet
              // epParam.schema = type;
            } else {
              Object.assign(epParam, type);
            }
          }

          epParams.push(epParam);
        }

        const epPath = !ep.path ? '/' : typeof ep.path === 'string' ? (ep.path as string) : (ep.path as RegExp).source;

        paths[epPath] = {
          ...paths[epPath] || {},
          [ep.method!]: {
            tags: [tagName],
            produces,
            consumes,
            responses,
            summary: ep.title,
            description: ep.description || ep.title,
            operationId: `${ep.class.name}_${ep.handlerName}`,
            parameters: epParams
          } as Operation
        };
      }
    }

    return {
      paths,
      tags,
      definitions
    };
  }
}