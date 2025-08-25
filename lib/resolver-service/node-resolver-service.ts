import { resolve4, resolve6 } from 'node:dns/promises';
import { ResolvedAddress, ResolverService } from './resolver-service';

/**
 * NodeResolver is a simple resolver service based on NodeJS built-in [dns.resolve4](https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve4hostname-options) and [dns.resolve6](https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve6hostname-options).
 * LookupController uses it to load initial cache data and save cache data for future usage.
 *
 * @group ResolverService
 * @example
 * import { LookupController, NodeResolverService } from 'super-dns-lookup';
 *
 * const resolverService = new NodeResolverService();
 * const lookupController = new LookupController({ resolverService });
 */
export class NodeResolverService implements ResolverService {
  /**
   * Resolves hostname to an IPv4 addresses using DNS query.
   * Provides the IP address and A record TTL for each found record.
   * Proxies resolution request to NodeJS built-in [dns.resolve6](https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve4hostname-options).
   *
   * @example
   * import { equal } from 'node:assert';
   * import { NodeResolverService } from 'super-dns-lookup';
   *
   * const resolverService = new NodeResolverService();
   * const address = await resolverService.resolve4('localhost');
   * equal(address, '127.0.0.1');
   * @param hostname Hostname to resolve.
   * @returns Promise of found IP address and A record TTL pairs list.
   */
  public async resolve4(hostname: string): Promise<ResolvedAddress[]> {
    return resolve4(hostname, { ttl: true });
  }

  /**
   * Resolves hostname to an IPv6 addresses using DNS query.
   * Provides the IP address and AAAA record TTL for each found record.
   * Proxies resolution request to NodeJS built-in [dns.resolve6](https://nodejs.org/docs/latest/api/dns.html#dnspromisesresolve6hostname-options).
   *
   * @example
   * import { equal } from 'node:assert';
   * import { NodeResolverService } from 'super-dns-lookup';
   *
   * const resolverService = new NodeResolverService();
   * const address = await resolverService.resolve6('localhost');
   * equal(address, '::1');
   * @param hostname Hostname to resolve.
   * @returns Promise of found IP address and A record TTL pairs list.
   */
  public async resolve6(hostname: string): Promise<ResolvedAddress[]> {
    return resolve6(hostname, { ttl: true });
  }
}
