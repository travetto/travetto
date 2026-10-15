import { ExpiresAt, Model, type ModelId } from '@travetto/model';
import { Text } from '@travetto/schema';

/**
 * Session model service identifier
 */
export const SessionModelSymbol = Symbol.for('@travetto/auth-session:model');

@Model({ autoCreate: 'production' })
export class SessionEntry {
  id: ModelId;
  @Text()
  data: string;
  @ExpiresAt()
  expiresAt?: Date;
  issuedAt: Date;
  maxAge?: number;
}
