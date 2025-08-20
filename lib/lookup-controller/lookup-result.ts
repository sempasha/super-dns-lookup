/**
 * Lookup result, basically string or list of strings,
 * decision is based on the value of `LookupOptions#all`.
 *
 * @group LookupController
 * @example
 * import { LookupResult } from 'super-dns-lookup';
 *
 * let singleAddress: Awaited<LookupResult<false>>;
 * let listOfAddresses: Awaited<LookupResult<true>>;
 */
export type LookupResult<All extends boolean | undefined = undefined> = All extends true ? string[] : string;
