import { type LookupAddress } from './lookup-address';

/**
 * Lookup result handler function, which ready to handle lookup of single address or address list.
 *
 * @group LookupController
 * @example
 * import { type LookupCallback } from 'super-dns-lookup';
 *
 * const handleLookup: LookupCallback = (error, addressOrAddresses, family) => {
 *   if (error) {
 *     console.error(error);
 *   } else if (typeof addressOrAddresses === 'string') {
 *     console.log(`found ${family === 6 ? 'IPv6' : 'IPv4'} address ${addressOrAddresses}`);
 *   } else {
 *     for (const { address, family } of addressOrAddresses) {
 *       console.log(`found ${family === 6 ? 'IPv6' : 'IPv4'} address ${address}`);
 *     }
 *   }
 * };
 */
export interface LookupCallback {
  (
    error: unknown | null,
    addressOrAddresses?: LookupAddress[] | LookupAddress['address'],
    family?: LookupAddress['family']
  ): void;
}

/**
 * Lookup result handler function, which ready to handle lookup of list of IP addresses.
 *
 * @group LookupController
 * @example
 * import { type LookupAllCallback } from 'super-dns-lookup';
 *
 * const handleLookup: LookupAllCallback = (error, addresses) => {
 *   if (error) {
 *     console.error(error);
 *   } else {
 *     for (const { address, family } of addresses) {
 *       console.log(`found ${family === 6 ? 'IPv6' : 'IPv4'} address ${address}`);
 *     }
 *   }
 * };
 */
export interface LookupAllCallback {
  (error: unknown | null, addresses?: LookupAddress[]): void;
}

/**
 * Lookup result handler function, which ready to handle lookup of single IP address.
 *
 * @group LookupController
 * @example
 * import { type LookupOneCallback } from 'super-dns-lookup';
 *
 * const handleLookup: LookupOneCallback = (error, address, family) => {
 *   if (error) {
 *     console.error(error);
 *   } else {
 *     console.log(`found ${family === 6 ? 'IPv6' : 'IPv4'} address ${addressOrAddresses}`);
 *   }
 * };
 */
export interface LookupOneCallback {
  (error: unknown | null, address?: LookupAddress['address'], family?: LookupAddress['family']): void;
}
