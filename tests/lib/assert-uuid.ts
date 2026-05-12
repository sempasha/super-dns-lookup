import { UUID } from 'node:crypto';

export function assertUUID(value: unknown): asserts value is UUID {
  if (typeof value !== 'string') {
    throw new Error(`Expect value ${JSON.stringify(value)} to be a string`);
  }
  if (!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(value)) {
    throw new Error(`Expect value ${JSON.stringify(value)} to be a UUID string`);
  }
}
