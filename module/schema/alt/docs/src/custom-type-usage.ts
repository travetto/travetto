import { Schema } from '../../../src/decorator/schema';
import { Point } from './custom-type';

@Schema()
export class LocationAware {
  name: string;
  point: Point;
}