/**
 * A hostname resolution result is an array of IP address and A/AAAA record TTL. This interface represents such a pair. {@link ResolverService#resolve4} and {@link ResolverService#resolve6} both return a list of IP address / ttl pairs.
 *
 * @group ResolverService
 * @example
 * import { type ResolvedAddress } from 'super-dns-lookup';
 *
 * function resolveExampleCom(hostname: string): ResolvedAddress[] {
 *   if (hostname === 'example.com') {
 *     return [
 *       ['23.192.228.80', 3600],
 *       ['23.192.228.84', 3600],
 *       ['23.215.0.136', 3600],
 *       ['23.215.0.138', 3600],
 *       ['96.7.128.175', 3600],
 *       ['96.7.128.198', 3600],
 *     ];
 *   }
 *   throw new NotFound(hostname);
 * }
 */
export interface ResolvedAddress {
  /**
   * An IP address string.
   */
  readonly address: string;

  /**
   * An A or AAAA record TTL expressed in seconds.
   */
  readonly ttl: number;
}
