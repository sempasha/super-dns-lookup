import { isIPv4, isIPv6 } from 'node:net';
import { IsIpService } from './is-ip-service';

/**
 * Implementation of IsIpService using NodeJS [dns.isIPv4](https://nodejs.org/docs/latest/api/net.html#netisipv4input) and [net.isIPv6](https://nodejs.org/docs/latest/api/net.html#netisipv6input) functions.
 *
 * @group IsIpService
 * @example
 * const isIpService = new NodeIsIpService();
 * const lookupController = new LookupController({ isIpService });
 */
export class NodeIsIpService implements IsIpService {
  /**
   * Tells whether provided string is IPv4 address or not.
   * Behaves the same way NodeJS's [net.isIPv4](https://nodejs.org/docs/latest/api/net.html#netisipv4input) does.
   *
   * @example
   * import { equal } from 'node:assert';
   * import { NodeIsIpService } from 'super-dns-lookup';
   *
   * const isIpService = new NodeIsIpService();
   * equal(isIpService.isIPv4('127.0.0.1'), true);
   * equal(isIpService.isIPv4('::1'), false);
   * @param string String to check.
   * @returns Only returns true when provided string is an IPv4 address string
   */
  public readonly isIPv4 = isIPv4;

  /**
   * Tells whether provided string is IPv4 address or not.
   * Behaves the same way NodeJS's [net.isIPv6](https://nodejs.org/docs/latest/api/net.html#netisipv6input) does.
   *
   * @example
   * import { equal } from 'node:assert';
   * import { NodeIsIpService } from 'super-dns-lookup';
   *
   * const isIpService = new NodeIsIpService();
   * equal(isIpService.isIPv6('::1'), true);
   * equal(isIpService.isIPv6('127.0.0.1'), false);
   * @param string String to check.
   * @returns Only returns true when provided string is an IPv6 address string
   */
  public readonly isIPv6 = isIPv6;
}
