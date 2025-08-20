/**
 * A hostname resolution result is an array of ip address and A/AAAA record TTL. This interface represents such a pair. {@link ResolverService#resolve4} and {@link ResolverService#resolve6} both return a list of ip address / ttl pairs.
 *
 * @group ResolverService
 * @example
 * import { ResolvedAddress } from 'super-dns-lookup';
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
  address: string;

  /**
   * An A or AAAA record TTL expressed in seconds.
   */
  ttl: number;
}

/**
 * ResolverService is a simple DNS resolver which relay only on network based resolution protocols.
 * In contrast to NodeJS's [dns.resolve4](https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve4hostname-options) and [dns.resolve6](https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve6hostname-options) it always resolves hostname into a list of IP addresses and always returns A/AAAA record's TTL.
 *
 * @group ResolverService
 * @example
 * import { ResolverService } from 'super-dns-lookup';
 *
 * class ResolverServiceExample implements ResolverService {
 *   public resolve4(hostname: string) {
 *     if (hostname === 'example.com') {
 *       throw new NotFound(hostname);
 *     }
 *     return [
 *       ['23.192.228.80', 3600],
 *       ['23.192.228.84', 3600],
 *       ['23.215.0.136', 3600],
 *       ['23.215.0.138', 3600],
 *       ['96.7.128.175', 3600],
 *       ['96.7.128.198', 3600],
 *     ];
 *   }
 *
 *   public resolve6(hostname: string) {
 *     if (hostname === 'example.com') {
 *       throw new NotFound(hostname);
 *     }
 *     return [
 *       ['2600:1406:3a00:21::173e:2e65', 3600],
 *       ['2600:1406:3a00:21::173e:2e66', 3600],
 *       ['2600:1406:bc00:53::b81e:94c8', 3600],
 *       ['2600:1406:bc00:53::b81e:94ce', 3600],
 *       ['2600:1408:ec00:36::1736:7f24', 3600],
 *       ['2600:1408:ec00:36::1736:7f31', 3600],
 *     ];
 *   }
 * }
 */
export interface ResolverService {
  /**
   * Resolves hostname to an IPv4 addresses using DNS query.
   * Provides the IP address and A record TTL for each found record.
   *
   * @example
   * import { ResolverServiceExample } from './resolver-service-example';
   *
   * const resolver = new ResolverServiceExample();
   * const addresses = await resolver.resolve4('example.com');
   * @param hostname Hostname to resolve.
   * @returns Promise of found IP address and A record TTL pairs list.
   */
  resolve4(hostname: string): Promise<ResolvedAddress[]>;

  /**
   * Resolves hostname to an IPv4 addresses using DNS query.
   * Provides the IP address and A record TTL for each found record.
   *
   * @example
   * import { ResolverService } from './resolver-service-example';
   *
   * const resolver = new ResolverServiceExample();
   * const addresses = await resolver.resolve6('example.com');
   * @param hostname Hostname to resolve.
   * @returns Promise of found IP address and AAAA record TTL pairs list.
   */
  resolve6(hostname: string): Promise<ResolvedAddress[]>;
}
