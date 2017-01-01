import * as mongoose from 'mongoose';
import { ModelCls } from '../lib';

export class ProjectionModelRegistry {
  static registerFieldFacet(target: any, prop: string, config: any) {
    return target;
  }

  static registerModelFacet<T>(cls: ModelCls<T>, data: any) {
    return cls;
  }

  static registerModel<T>(cls: ModelCls<T>, schemaOpts: mongoose.SchemaOptions = {}) {
    return cls;
  }
}

export function ProjectionModel(cls: ModelCls<any>, opts?: mongoose.SchemaOptions) {
  return (target: any) => ProjectionModelRegistry.registerModel<any>(target, opts);
}

export function ProjectionField(path: string) {
  return (f: any, prop: string) => {
    ProjectionModelRegistry.registerFieldFacet(f, prop, buildFieldConfig(type));
  };
}