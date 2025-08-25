import { type LiteralUnion } from 'type-fest';
import { type LookupController } from './lookup-controller';

/**
 * Single address found by {@link LookupController#lookup} function.
 *
 * @group LookupController
 * @example
 * import { type LookupAddress } from 'super-dns-lookup';
 *
 * const ipv4: LookupAddress = { address: '192.168.0.1', family: 4 };
 * const ipv6: LookupAddress = { address: '2345:425:2ca1::567:5673:23b5', family: 6 };
 */
export interface LookupAddress {
  /**
   * IP address
   */
  address: string;

  /**
   * Address family: `4` for IPv4 or `6` for IPv6 and number for compatibility with NodeJS typings.
   */
  family: LiteralUnion<4 | 6, number>;
}
