import * as mongoose from 'mongoose';
import { registerModel } from '../lib';

export function ProjectionModel(opts: mongoose.SchemaOptions = {}) {
  return (target: any) => registerModel<any>(target, opts);
}