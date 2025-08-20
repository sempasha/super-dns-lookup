import { LookupResult } from './lookup-result';

/**
 * Lookup result handler function.
 *
 * @group LookupController
 * @example
 * import { LookupCallback, LookupController } from 'super-dns-lookup';
 *
 * export function printExampleComAddress(controller: LookupController) {
 *   const handleResult: LookupCallback<false> = (error, address) => {
 *     if (error) {
 *       console.error(error);
 *     } else {
 *       console.info(address);
 *     }
 *   }
 *   controller.lookup('example.com', handleResult);
 * }
 */
export interface LookupCallback<All extends boolean | undefined = undefined> {
  /**
   * Handles the result of lookup.
   *
   * @param error Error which has been occurred during lookup or undefined in case of success.
   * @param result Lookup result according to lookup options or undefined when error has been occurred.
   * @returns Nothing.
   */
  (error: unknown | undefined, result: LookupResult<All> | undefined): void;
}
