import * as mg from 'mongoose';
import { Cls } from './types';
import { SchemaRegistry } from './registry';

let mongoose = require('mongoose/lib/browser');
mongoose.Document = require('mongoose/lib/browserDocument.js');

export class SchemaValidator {

    static schemas: Map<Cls<any>, Map<string, mg.Schema>> = new Map();

    static getSchema<T>(cls: Cls<T>, view: string = SchemaRegistry.DEFAULT_VIEW) {
        if (!SchemaValidator.schemas.has(cls)) {
            SchemaValidator.schemas.set(cls, new Map());
        }
        let viewMap: Map<string, mg.Schema> = SchemaValidator.schemas.get(cls) as Map<string, mg.Schema>;
        if (!viewMap.has(view)) {
            let config = SchemaRegistry.schemas.get(cls);
            if (!config || !config.views[view]) {
                throw new Error(`Unknown view found: ${view}`);
            }
            viewMap.set(view, SchemaValidator.getSchemaRaw(config.views[view].schema));
        }
        return viewMap.get(view) as mg.Schema;
    }

    static getSchemaRaw(schema: any, opts: mg.SchemaOptions = {}): mg.Schema {
        return new mongoose.Schema(schema, opts);
    }

    static async validateRaw<T>(o: T, schema: mg.Schema): Promise<T> {
        let doc = new mongoose.Document(o, schema);
        await doc.validate();
        return o;
    }

    static async validateAllRaw<T>(obj: T[], schema: mg.Schema): Promise<T[]> {
        return await Promise.all<T>((obj || [])
            .map((o, i) => SchemaValidator.validateRaw(o, schema)));
    }

    static async validate<T>(o: T, view?: string): Promise<T> {
        return await SchemaValidator.validateRaw(o, SchemaValidator.getSchema(SchemaRegistry.getCls(o), view));
    }

    static async validateAll<T>(obj: T[], view?: string): Promise<T[]> {
        return await Promise.all<T>((obj || [])
            .map((o, i) => SchemaValidator.validate(o, view)));
    }
}