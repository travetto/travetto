import { type Point, Schema } from '@travetto/schema';

@Schema()
export class LocationAware {
  name: string;
  point: Point;
}
