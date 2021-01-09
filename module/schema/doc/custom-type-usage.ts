import { Schema } from '@travetto/schema';
import { Point } from './custom-type';

@Schema()
export class LocationAware {
  name: string;
  point: Point;
}