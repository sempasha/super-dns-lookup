/**
 * A pair consisting of a hostname and its associated IP address extracted from the hosts file.
 * Interface is used by {@link HostsFileService#read} to describe the result.
 *
 * @group HostsFileService
 * @example
 * import { type HostnameAddressPair } from 'super-dns-lookup';
 *
 * const pairs: HostnameAddressPair[] = [
 *   ['example.com', '23.192.228.80'],
 *   ['example.com', '2600:1406:3a00:21::173e:2e65'],
 * ];
 */
export type HostnameAddressPair = [string, string];
