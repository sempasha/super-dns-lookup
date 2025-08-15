import { resolve4, resolve6 } from 'node:dns/promises';

/**
 * A hostname resolution result. The pair of IP address and TTL value in seconds.
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
 * In contrast to NodeJS's dns.resolve4 and dns.resolve6 it always resolves hostname into a list of IP addresses and always returns A/AAAA record's TTL.
 *
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
 * @see https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve4hostname-options
 * @see https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve6hostname-options
 */
export interface ResolverService {
  /**
   * Should resolve hostname to an IPv4 addresses using DNS query.
   * Should return the IP address and A record TTL for each found record.
   *
   * @example
   * import { ResolverServiceExample } from './resolver-service-example';
   *
   * const resolver = new ResolverServiceExample();
   * const addresses = await resolver.resolve4('example.com');
   * @param hostname Hostname to resolve
   * @return Promise of resolved list of IP address and A record TTL pairs.
   */
  resolve4(hostname: string): Promise<ResolvedAddress[]>;

  /**
   * Should resolve hostname to an IPv4 addresses using DNS query.
   * Should return the IP address and A record TTL for each found record.
   *
   * @example
   * import { ResolverService } from './resolver-service-example';
   *
   * const resolver = new ResolverServiceExample();
   * const addresses = await resolver.resolve6('example.com');
   * @param hostname Hostname to resolve
   * @return Promise of resolved list of IP address and AAAA record TTL pairs.
   */
  resolve6(hostname: string): Promise<ResolvedAddress[]>;
}

/**
 * NodeResolver is a simple resolver service based on NodeJS's built-in dns.resolve4 and dns.resolve6.
 * LookupController uses it to load initial cache data and save cache data for future usage.
 *
 * @example
 * import { LookupController, NodeResolverService } from 'super-dns-lookup';
 *
 * const resolverService = new NodeResolverService();
 * const lookupController = new LookupController({ resolverService });
 * @see https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve4hostname-options
 */
export class NodeResolverService implements ResolverService {
  /**
   * @example
   * import { equal } from 'node:assert';
   * import { NodeResolverService } from 'super-dns-lookup';
   *
   * const resolverService = new NodeResolverService();
   * const address = await resolverService.resolve4('localhost');
   * equal(address, '127.0.0.1');
   * @see https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve6hostname-options
   * @param hostname
   */
  public async resolve4(hostname: string): Promise<ResolvedAddress[]> {
    return resolve4(hostname, { ttl: true });
  }

  /**
   * @example
   * import { equal } from 'node:assert';
   * import { NodeResolverService } from 'super-dns-lookup';
   *
   * const resolverService = new NodeResolverService();
   * const address = await resolverService.resolve6('localhost');
   * equal(address, '::1');
   * @see https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve6hostname-options
   * @param hostname
   */
  public async resolve6(hostname: string): Promise<ResolvedAddress[]> {
    return resolve6(hostname, { ttl: true });
  }
}
