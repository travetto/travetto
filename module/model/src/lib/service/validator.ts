import * as mg from "mongoose";
import { Base, Named } from '@encore/model';
import { BaseModel, Model } from '../model';
import { nodeToPromise } from '@encore/util';
import { getCls } from '../util';

let mongoose = require('mongoose/lib/browser');
mongoose.Document = require('mongoose/lib/browserDocument.js');

export class Validator {

  static schemas: { [cls: string]: mongoose.Schema } = {};

  static getSchema<T extends BaseModel>(cls: Model<T>) {
    if (!Validator.schemas[cls.name]) {
      Validator.schemas[cls.name] = new mongoose.Schema(cls.schema, cls.schemaOpts);
    }
    return Validator.schemas[cls.name];
  }

  static async validate<T extends BaseModel>(o: T): Promise<T> {
    let schema = Validator.getSchema(getCls(o));
    let doc = new mongoose.Document(o, schema);
    await doc.validate();
    return o;
  }

  static async validateAll<T extends BaseModel>(obj: T[]): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => Validator.validate(o, Validator.getSchema(getCls(o)))));
  }
}