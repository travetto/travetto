import { Schema } from '@travetto/schema';

/**
 * User Address
 */
@Schema()
export class Address {
  street1: string;
  street2?: string;
  city: string;
  stateOrProvince: string;
  zip: string;
  country: string;
}