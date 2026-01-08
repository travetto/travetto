import { Schema, type Point } from '@travetto/schema';

@Schema()
export class LocationAware {
  name: string;
  point: Point;
}