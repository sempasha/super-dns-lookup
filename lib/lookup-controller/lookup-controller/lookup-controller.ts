import { EventEmitter } from 'node:events';
import { type Agent as HttpAgent } from 'node:http';
import { type Agent as HttpsAgent } from 'node:https';
import { type CacheService } from '../../cache-service';
import { type ChoiceStrategy } from '../../choice-strategy';
import { type FailoverStrategy } from '../../failover-strategy';
import { type HostsFileService } from '../../hosts-file-service';
import { type IsIpService } from '../../is-ip-service';
import { type PersistentStorageService } from '../../persistent-storage-service';
import { type ResolverService } from '../../resolver-service';
import { type ThrottlingStrategy } from '../../throttling-strategy';
import { type LookupAddress } from './lookup-address';
import { type LookupCallback, type LookupAllCallback, type LookupOneCallback } from './lookup-callback';
import { type LookupOptions, type LookupAllOptions, type LookupOneOptions } from './lookup-options';

/**
 * Lookup controller itself.
 *
 * @group LookupController
 * @example // Get example.com IP address.
 * import { SuperLookupController } from 'super-dns-lookup';
 *
 * const controller = new SuperLookupController();
 * controller.lookup('example.com', (error, address) => {
 *   if (error) {
 *     console.error(error);
 *   } else {
 *     console.info(address);
 *   }
 * });
 *
 * @example // Export dns.lookup compatible function.
 * import { SuperLookupController } from 'super-dns-lookup';
 *
 * const controller = new SuperLookupController();
 * void controller.bootstrap();
 * process.once('SIGTERM', () => controller.teardown());
 * export const lookup = controller.lookup.bind(controller);
 */
export interface LookupController extends EventEmitter<{ error: [unknown] }> {
  /**
   * Prepares {@link LookupController} for lookup requests handling, method should be part of application bootstrap.
   * Preloads cache using {@link PersistentStorageService#read} when service provided.
   * Reads hosts file using {@link HostsFileService#read}.
   * Starts watching for hosts file using {@link HostsFileService#watch} before reading the file.
   * While watching {@link LookupController} should read hosts file on every hosts file change.
   * While reading hosts file data, {@link LookupController} should consider {@link HostsFileNotFound} as a signal to forget all the data previously loaded from hosts file.
   * Error {@link HostsFileNotReadable} should be considered as a signal to stop reading file and keep previously read data.
   *
   * @example
   * import { SuperLookupController } from 'super-dns-lookup';
   *
   * export class Application {
   *   public constructor(
   *     protected readonly lookupController: LookupController = new SuperLookupController(),
   *   ) {}
   *
   *   public async bootstrap() {
   *     await this.lookupController.bootstrap();
   *     // then start all other application components when lookup controller is ready
   *   }
   *
   *   public teardown() {
   *     // first stop all other application components and then
   *     await this.lookupController.teardown();
   *   }
   * }
   * @see {@link LookupController#teardown}
   * @see {@link PersistentStorageService#read}
   * @see {@link HostsFileService#read}
   * @see {@link HostsFileService#watch}
   * @returns Promise that bootstrap will complete successfully.
   */
  bootstrap(): Promise<void>;

  /**
   * If {@link LookupController#bootstrap} has been called controller will stop watching for hosts file changes by calling {@link HostsFileService#stopWatching}.
   * If persistent storage has been configured with {@link PersistentStorageService}, controller will read entire cache using {@link CacheService#entries}, serialize everything into single data object and will write it out using {@link PersistentStorageService#write}.
   *
   * @example
   * import { SuperLookupController } from 'super-dns-lookup';
   *
   * export class Application {
   *   public constructor(
   *     protected readonly lookupController: LookupController = new SuperLookupController(),
   *   ) {}
   *
   *   public async bootstrap() {
   *     await this.lookupController.bootstrap();
   *     // then start all other application components when lookup controller is ready
   *   }
   *
   *   public teardown() {
   *     // first stop all other application components and then
   *     await this.lookupController.teardown();
   *   }
   * }
   * @see {@link LookupController#bootstrap}
   * @see {@link HostsFileService#stopWatching}
   * @see {@link CacheService#entries}
   * @see {@link PersistentStorageService#write}
   * @returns Promise that teardown will complete successfully.
   */
  teardown(): Promise<void>;

  /**
   * Makes [http.Agent](https://nodejs.org/docs/latest/api/http.html#class-httpagent) or [https.Agent](https://nodejs.org/docs/latest/api/https.html#class-httpsagent) to use {@link LookupController#lookup} to resolve hostname when agent creates new [connection](https://nodejs.org/docs/latest/api/http.html#agentcreateconnectionoptions-callback).
   *
   * @param agent [http.Agent](https://nodejs.org/docs/latest/api/http.html#class-httpagent) or [https.Agent](https://nodejs.org/docs/latest/api/https.html#class-httpsagent) where {@link LookupController#lookup} must be installed and used as `lookup` option during [createConnection](https://nodejs.org/docs/latest/api/http.html#agentcreateconnectionoptions-callback) call.
   */
  install(agent: HttpAgent | HttpsAgent): void;

  /**
   * Resolution process consists of attempt to resolve hostname via {@link IsIpService}, then via {@link HostsFileService} and finally via {@link ResolverService}.
   * During resolution via {@link IsIpService}, hostname will tested whether it is IP address or not using {@link IsIpService#isIPv4} and {@link IsIpService#isIPv6} methods, resolution will be completed when these methods shows positive result.
   * Data received from {@link ResolverService} will be saved via {@link CacheService} for future usage.
   * Calls of {@link ResolverService} will be throttled via {@link ThrottlingStrategy}.
   * Errors thrown by {@link ResolverService} will be handled via {@link FailoverStrategy}.
   * Method is hard bound to {@link LookupController} instance.
   *
   * @field lookup
   */

  /**
   * Returns promise that hostname will be resolved into single IP address.
   * Resolves hostname into single IP address of any family 4 or 6.
   * Use no lookup hints ({@link LookupOneOptions#hints}).
   * Rejects promise in case of lookup error.
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @returns Promise of lookup results.
   */
  lookup(hostname: string): Promise<LookupAddress>;

  /**
   * Returns promise that hostname will be resolved into single IP address.
   * Resolves hostname into IP address of specified family.
   * Use no lookup hints ({@link LookupOneOptions#hints}).
   * Rejects promise in case of lookup error.
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @param family IP address family.
   * @returns Promise of lookup results.
   */
  lookup(hostname: string, family: LookupOneOptions['family']): Promise<LookupAddress>;

  /**
   * Returns promise that hostname will be resolved into single IP address.
   * Respects all {@link LookupOneOptions}.
   * Rejects promise in case of lookup error.
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @returns Promise of lookup results.
   */
  lookup(hostname: string, options: LookupOneOptions): Promise<LookupAddress>;

  /**
   * Returns promise that hostname will be resolved into list of IP addresses.
   * Respects all {@link LookupAllOptions}.
   * Rejects promise in case of lookup error.
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @returns Promise of lookup results.
   */
  lookup(hostname: string, options: LookupAllOptions): Promise<LookupAddress[]>;

  /**
   * Returns promise that hostname will be resolved into single IP address or list of IP addresses.
   * Respects all {@link LookupOptions}.
   * Rejects promise in case of lookup error.
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @returns Promise of lookup results.
   */
  lookup(hostname: string, options: LookupOptions): Promise<LookupAddress | LookupAddress[]>;

  /**
   * Resolves hostname into single address and pass result into callback function.
   * Resolves hostname into single IP address of any family 4 or 6.
   * Use no lookup hints ({@link LookupOneOptions#hints}).
   * Sends lookup error into callback function ({@link LookupOneCallback}).
   *
   * {@label CALLBACK}
   * @param hostname Hostname to resolve.
   * @param callback Lookup callback function ready to handle IP address and its family.
   */
  lookup(hostname: string, callback: LookupOneCallback): void;

  /**
   * Resolves hostname into single address and pass result into callback function.
   * Resolves hostname into IP address of specified family.
   * Use no lookup hints ({@link LookupOneOptions#hints}).
   * Sends lookup error into callback function ({@link LookupOneCallback}).
   *
   * {@label CALLBACK}
   * @param hostname Hostname to resolve.
   * @param family IP address family.
   * @param callback Lookup callback function ready to handle IP address and its family.
   */
  lookup(hostname: string, family: LookupOneOptions['family'], callback: LookupOneCallback): void;

  /**
   * Resolves hostname into single address and pass result into callback function.
   * Respects all lookup options {@link LookupOneOptions} (except all).
   * Sends lookup error into callback function ({@link LookupOneCallback}).
   *
   * {@label CALLBACK}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @param callback Lookup callback function ready to handle IP address and its family.
   */
  lookup(hostname: string, options: LookupOneOptions, callback: LookupOneCallback): void;

  /**
   * Resolves hostname into single address of any family and pass result into callback function.
   * Respects all lookup options {@link LookupAllOptions} (except all).
   * Sends lookup error into callback function ({@link LookupAllCallback}).
   *
   * {@label CALLBACK}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @param callback Lookup callback function ready to handle list of IP addresses.
   */
  lookup(hostname: string, options: LookupAllOptions, callback: LookupAllCallback): void;

  /**
   * Returns promise that hostname will be resolved into single IP address or list of IP addresses.
   * Respects all lookup options {@link LookupOptions}.
   * Rejects promise in case of lookup error.
   *
   * {@label CALLBACK}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @returns Promise of lookup results.
   */
  lookup(hostname: string, options: LookupOptions, callback: LookupCallback): void;
}
