import { ADDRCONFIG, ALL, V4MAPPED } from 'node:dns';
import type { LookupOptions as DNSLookupOptions } from 'node:dns';

/**
 * {@link LookupController#lookup} options. The goal of {@link LookupController} is to provide lookup function fully compatible with NodeJS built-in [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback), so basically LookupOptions matches with dns.lookup options.
 *
 * @group LookupController
 * @example
 * import { LookupOptions, LookupController } from 'super-dns-lookup';
 *
 * export async function getIp4Addresses(
 *   hostname: string,
 *   controller: LookupController
 * ): Promise<string[]> {}
 *   const lookupOptions: LookupOptions<true> = {
 *     family: 4,
 *     all: true,
 *   };
 *   return controller.lookup(hostname, lookupOptions);
 * }
 */
export interface LookupOptions<All extends boolean | undefined = undefined> extends DNSLookupOptions {
  /**
   * When `true`, the callback returns all resolved addresses in an array.
   * Otherwise, returns a single address.
   *
   * @default false
   */
  all?: All | undefined;

  /**
   * The record family. Must be `4`, `6`, or `0`.
   * For backward compatibility reasons, `'IPv4'` and `'IPv6'` are interpreted as `4` and `6` respectively.
   * The value `0` indicates that either an IPv4 or IPv6 address is returned.
   * If the value `0` is used with `{ all: true }` (see below),
   * either one of or both IPv4 and IPv6 addresses are returned, depending on the system's DNS resolver.
   *
   * @default 0
   */
  family?: 0 | 4 | 6 | 'IPv4' | 'IPv6' | number | undefined;

  /**
   * One or more supported [getaddrinfo flags](https://nodejs.org/docs/latest/api/dns.html#supported-getaddrinfo-flags).
   * Multiple flags may be passed by bitwise ORing their values.
   *
   * @default 0
   */
  hints?: 0 | typeof ADDRCONFIG | typeof ALL | typeof V4MAPPED | undefined;

  /**
   * When `'verbatim'`, the resolved addresses are return unsorted.
   * When `'ipv4first'`, the resolved addresses are sorted by placing IPv4 addresses before IPv6 addresses.
   * When `'ipv6first'`, the resolved addresses are sorted by placing IPv6 addresses before IPv4 addresses.
   *
   * @default 'verbatim'
   */
  order?: 'ipv4first' | 'ipv6first' | 'verbatim' | undefined;

  /**
   * When `true`, the callback receives IPv4 and IPv6 addresses in the order the DNS resolver returned them.
   * When `false`, IPv4 addresses are placed before IPv6 addresses.
   * This option is deprecated in favor of `order`, when both are specified, order has higher precedence.
   *
   * @default true
   * @deprecated Please use `order` option instead.
   */
  verbatim?: boolean | undefined;
}
