/**
 * IsIpService is a simple IP address recognition service.
 * It tells whether provided value is IPv4 or IPv6 address or not an IP at all.
 * Basically it does the same as [dns.isIPv4](https://nodejs.org/docs/latest/api/net.html#netisipv4input) and [dns.isIPv6](https://nodejs.org/docs/latest/api/net.html#netisipv6input) do.
 *
 * @group IsIpService
 * @example
 * import { IsIpService } from 'super-and-lookup';
 * import ipRegex from 'ip-regex';
 *
 * export class IsIpServiceExample implements IsIpService {
 *   public isIPv4(string: string) {
 *     return ipRegex.v4.test(string);
 *   }
 *
 *   public isIPv6(string: string) {
 *     return ipRegex.v6.test(string);
 *   }
 * }
 */
export interface IsIpService {
  /**
   * Tells whether provided string is IPv4 address or not.
   * Behaves the same way NodeJS's [net.isIPv4](https://nodejs.org/docs/latest/api/net.html#netisipv4input) does.
   *
   * @example
   * import { equal } from 'node:assert';
   * import { IsIpServiceExample } from './is-ip-service-example';
   *
   * const isIpService = new IsIpServiceExample();
   * equal(isIpService.isIPv4('127.0.0.1'), true);
   * equal(isIpService.isIPv4('::1'), false);
   * @param string String to check.
   * @returns Only returns true when provided string is an IPv4 address string
   */
  isIPv4(string: string): boolean;

  /**
   * Tells whether provided string is IPv4 address or not.
   * Behaves the same way NodeJS's [net.isIPv6](https://nodejs.org/docs/latest/api/net.html#netisipv6input) does.
   *
   * @example
   * import { equal } from 'node:assert';
   * import { IsIpServiceExample } from './is-ip-service-example';
   *
   * const isIpService = new IsIpServiceExample();
   * equal(isIpService.isIPv6('::1'), true);
   * equal(isIpService.isIPv6('127.0.0.1'), false);
   * @param string String to check.
   * @returns Only returns true when provided string is an IPv6 address string
   */
  isIPv6(string: string): boolean;
}
