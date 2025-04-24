import { Schema, Point } from '@travetto/schema';

@Schema()
export class LocationAware {
  name: string;
  point: Point;
}