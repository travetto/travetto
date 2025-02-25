import { Schema } from '@travetto/schema';
import { Point } from './custom-type.ts';

@Schema()
export class LocationAware {
  name: string;
  point: Point;
}