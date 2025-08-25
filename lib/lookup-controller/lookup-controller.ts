import { EventEmitter } from 'node:events';
import { type Agent as HttpAgent } from 'node:http';
import { type Agent as HttpsAgent } from 'node:https';
import { type CacheService, LRUCacheService } from '../cache-service';
import { type ChoiceStrategy, RoundRobinChoiceStrategy } from '../choice-strategy';
import { type FailoverStrategy, UniversalFailoverStrategy } from '../failover-strategy';
import { type HostsFileService, UniversalHostsFileService } from '../hosts-file-service';
import { type IsIpService, NodeIsIpService } from '../is-ip-service';
import { type PersistentStorageService } from '../persistent-storage-service';
import { NodeResolverService, type ResolverService } from '../resolver-service';
import { type ThrottlingStrategy, UniversalThrottlingStrategy } from '../throttling-strategy';
import { InvalidHostnameAddressPair } from './errors';
import { type LookupAddress } from './lookup-address';
import { type LookupCallback, type LookupAllCallback, type LookupOneCallback } from './lookup-callback';
import { type LookupControllerOptions } from './lookup-controller-options';
import { type LookupOptions, type LookupAllOptions, type LookupOneOptions } from './lookup-options';

/**
 * Lookup controller itself.
 *
 * @group LookupController
 * @example // Get example.com IP address.
 * import { LookupController } from 'super-dns-lookup';
 *
 * const controller = new LookupController();
 * controller.lookup('example.com', (error, address) => {
 *   if (error) {
 *     console.error(error);
 *   } else {
 *     console.info(address);
 *   }
 * });
 *
 * @example // Export dns.lookup compatible function.
 * import { LookupController } from 'super-dns-lookup';
 *
 * const controller = new LookupController();
 * void controller.bootstrap();
 * process.once('SIGTERM', () => controller.teardown());
 * export const lookup = controller.lookup.bind(controller);
 */
export class LookupController extends EventEmitter<{ error: [unknown] }> {
  protected readonly cacheService: CacheService;
  protected readonly choiceStrategy: ChoiceStrategy;
  protected readonly failoverStrategy: FailoverStrategy;
  protected hostsFileErrorhandler: ((error: unknown) => void) | undefined;
  protected hostsFileReadPromise: Promise<Map<string, LookupAddress[]>> | undefined;
  protected readonly hostsFileService: HostsFileService;
  protected readonly isIpService: IsIpService;
  protected readonly persistentStorageService: PersistentStorageService | null;
  protected readonly resolverService: ResolverService;
  protected readonly throttlingStrategy: ThrottlingStrategy | null;

  /**
   * Creates {@link LookupController} with given options.
   *
   * @example // Create LookupController with all default options
   * import { LookupController } from 'super-dns-lookup';
   *
   * const controller = new LookupController();
   * @example // Create LookupController with increased cache
   * import { LookupController, LRUCacheService } from 'super-dns-lookup';
   *
   * const cacheService = new LRUCacheService({ maxHostnames: 10_000 });
   * const controller = new LookupController({ cacheService });
   * @param options Controller options which is better not to ignore.
   */
  public constructor({
    cacheService = new LRUCacheService(),
    choiceStrategy = new RoundRobinChoiceStrategy(),
    failoverStrategy = new UniversalFailoverStrategy(),
    hostsFileService = new UniversalHostsFileService(),
    isIpService = new NodeIsIpService(),
    persistentStorageService = null,
    resolverService = new NodeResolverService(),
    throttlingStrategy = new UniversalThrottlingStrategy()
  }: LookupControllerOptions = {}) {
    super();
    this.cacheService = cacheService;
    this.choiceStrategy = choiceStrategy;
    this.failoverStrategy = failoverStrategy;
    this.hostsFileService = hostsFileService;
    this.isIpService = isIpService;
    this.persistentStorageService = persistentStorageService;
    this.resolverService = resolverService;
    this.throttlingStrategy = throttlingStrategy;
    this.hostsFileService.on('error', (error) => {
      this.emit('error', error);
    });
  }

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
   * import { LookupController } from 'super-dns-lookup';
   *
   * export class Application {
   *   public constructor(
   *     protected readonly lookupController: LookupController = new LookupController(),
   *   ) {}
   *
   *   public async bootstrap() {
   *     await this.lookupController.bootstrap();
   *     // then start all other application components when lookup controller is ready
   *   }
   *
   *   public teardown() {
   *     // first stop all other application components and then
   *     await this.lookupController.bootstrap();
   *   }
   * }
   * @see {@link LookupController#teardown}
   * @see {@link PersistentStorageService#read}
   * @see {@link HostsFileService#read}
   * @see {@link HostsFileService#watch}
   * @returns Promise that bootstrap will complete successfully.
   */
  public async bootstrap() {
    this.hostsFileService.watch(() => {
      this.hostsFileReadPromise = undefined;
      this.readHostsFile().catch((error) => {
        this.emit('error', error);
      });
    });
    await this.readHostsFile();
  }

  /**
   * Makes [http.Agent](https://nodejs.org/docs/latest/api/http.html#class-httpagent) or [https.Agent](https://nodejs.org/docs/latest/api/https.html#class-httpsagent) to use {@link LookupController#lookup} to resolve hostname when agent creates new [connection](https://nodejs.org/docs/latest/api/http.html#agentcreateconnectionoptions-callback).
   *
   * @param agent [http.Agent](https://nodejs.org/docs/latest/api/http.html#class-httpagent) or [https.Agent](https://nodejs.org/docs/latest/api/https.html#class-httpsagent) where {@link LookupController#lookup} must be installed and used as `lookup` option during [createConnection](https://nodejs.org/docs/latest/api/http.html#agentcreateconnectionoptions-callback) call.
   */
  public async install(agent: HttpAgent | HttpsAgent) {
    throw new Error('Method not implemented.');
  }

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
  public lookup(hostname: string): Promise<LookupAddress>;

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
  public lookup(hostname: string, family: LookupOneOptions['family']): Promise<LookupAddress>;

  /**
   * Returns promise that hostname will be resolved into single IP address.
   * Respects all lookup options {@link LookupOneOptions} (except all).
   * Rejects promise in case of lookup error.
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @returns Promise of lookup results.
   */
  public lookup(hostname: string, options: LookupOneOptions): Promise<LookupAddress>;

  /**
   * Returns promise that hostname will be resolved into list of IP addresses.
   * Respects all lookup options {@link LookupAllOptions} (except all).
   * Rejects promise in case of lookup error.
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @returns Promise of lookup results.
   */
  public lookup(hostname: string, options: LookupAllOptions): Promise<LookupAddress[]>;

  /**
   * Returns promise that hostname will be resolved into single IP address or list of IP addresses.
   * Respects all lookup options {@link LookupOptions}.
   * Rejects promise in case of lookup error.
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @returns Promise of lookup results.
   */
  public lookup(hostname: string, options: LookupOptions): Promise<LookupAddress | LookupAddress[]>;

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
  public lookup(hostname: string, callback: LookupOneCallback): void;

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
  public lookup(hostname: string, family: LookupOneOptions['family'], callback: LookupOneCallback): void;

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
  public lookup(hostname: string, options: LookupOneOptions, callback: LookupOneCallback): void;

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
  public lookup(hostname: string, options: LookupAllOptions, callback: LookupAllCallback): void;

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
  public lookup(hostname: string, options: LookupOptions, callback: LookupCallback): void;

  /**
   * Supports all the options NodeJS built-in [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback) has, check out {@link LookupOptions}.
   * Checks whether the given `hostname` is an IP address using {@link IsIpService#isIPv4} or {@link IsIpService#isIPv6} and returns it when the `hostname` is an IP address and the address family does not conflict with {@link LookupOptions#family}.
   * Caches the result of the 'isIP' check to be able to tell whether given `hostname` is an IP address or not without using {@link IsIpService#isIPv4} and {@link IsIpService#isIPv6} methods.
   * When the provided `hostname` is an IP address of the IPv4 family, if {@link LookupOptions#family} instructs to look for IPv6 addresses and {@link LookupOptions#hints} has the `dns.V4MAPPED` flag set, then the lookup ends up with an IPv4 address mapped to IPv6.
   * When the provided `hostname` is an IP address and it does not match the provided lookup options, the controller throws a `dns.NOTFOUND` [error](https://nodejs.org/api/dns.html#error-codes).
   * When the given `hostname` is not an IP address, the controller tries to resolve it using hosts file data.
   * When {@link LookupController#lookup} has been called before {@link LookupController#bootstrap}, the controller should read host file first.
   * While reading hosts file data, {@link LookupController} should consider errors {@link HostsFileNotFound} and {@link HostsFileNotReadable} as empty hosts file without data.
   * When the given `hostname` can't be resolved using hosts file data, the controller tries to resolve it using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on the specified options.
   * Stores the result of {@link ResolverService#resolve4} and {@link ResolverService#resolve6} for the given `hostname` in the cache using {@link CacheService#set} to use cached data for subsequent lookup request processing.
   * When the controller has only actual cache data for the given `hostname` and `options`, it will reply using data from the cache.
   * When the controller has only expired cache data for the given `hostname` and `options`, it will perform `hostname` resolution (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`), save the resolution results in the cache, and reply using the fresh resolution result.
   * When the controller has both actual and expired cache data for the given `hostname` and `options`, it will reply using actual data only and perform background `hostname` resolution (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`) to refresh the cache.
   * When the controller has only expired cache data for the given `hostname` and `options`, if the `hostname` resolution attempt (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`) has failed with some error, the controller rejects the lookup request if {@link FailoverStrategy#useExpiredCache} instructs to do so.
   * When {@link FailoverStrategy#useExpiredCache} instructs to use expired cache, {@link LookupController} should use expired cache but only for cache that expired less than ``.
   * When {@link FailoverStrategy#useExpiredCache} instructs to use expired cache, {@link LookupController} should use expired cache but only when there is cache that expired less than `maxExpirationMs` ago.
   * When the resolution of the hostname (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`) has failed, the controller should not cache the resolution error until {@link FailoverStrategy#cacheResolverFailure} instructs to do so.
   * When {@link FailoverStrategy#cacheResolverFailure} instructs to cache the resolution error, the controller must store the error in the cache and use it to reject all subsequent lookup requests for the given `hostname` during the next `ttlMs` without attempting to resolve the `hostname` again.
   * Gives precedence to the decision of {@link FailoverStrategy#useExpiredCache} to use expired cache rather than rejecting requests with cached resolution errors.
   * Uses only throttled version of resolution methods ({@link ResolverService#resolve4} or {@link ResolverService#resolve6} depending on `options`) created by {@link ThrottlingStrategy#throttle}.
   * Creates its own throttled version of the resolution method for each given hostname that needs to be resolved.
   * Reuses the throttled resolution method when one has already been created.
   * Forgets the throttled resolution method right after all promises created by the throttled method have been resolved, i.e., resolution requests have been completed.
   * Compatible with both [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback) and [dns/promises.lookup](https://nodejs.org/docs/latest/api/dns.html#dnspromiseslookuphostname-options) resolution methods.
   *
   * @param hostname Hostname to resolve.
   * @param optionsOrFamilyOrCallback Depending on used signature here may be an options or callback function or nothing.
   * @param maybeCallback Depending on used signature here may be callback function or nothing.
   * @returns Depending on used signature it may be nothing (when callback used) or promise of lookup result (when no callback used).
   */
  public lookup(
    hostname: string,
    optionsOrFamilyOrCallback?:
      | LookupOptions['family']
      | LookupOptions
      | LookupAllOptions
      | LookupOneOptions
      | LookupOneCallback
      | undefined,
    maybeCallback?: LookupCallback | LookupAllCallback | LookupOneCallback | undefined
  ): Promise<LookupAddress | LookupAddress[]> | void {
    let callback: LookupCallback | undefined;
    let options: LookupOptions;

    if (this.isCallback(maybeCallback)) {
      callback = maybeCallback;
    } else if (this.isCallback(optionsOrFamilyOrCallback)) {
      callback = optionsOrFamilyOrCallback as LookupCallback;
    }
    if (this.isFamily(optionsOrFamilyOrCallback)) {
      options = { family: optionsOrFamilyOrCallback };
    } else if (this.isOptions(optionsOrFamilyOrCallback)) {
      options = optionsOrFamilyOrCallback;
    } else {
      options = {};
    }
    if (callback) {
      if (options.all) {
        this.lookupAll(hostname, options).then(
          (result) => callback(null, result),
          (error) => callback(error)
        );
      } else {
        this.lookupOne(hostname, options).then(
          ({ address, family }) => callback(null, address, family),
          (error) => callback(error)
        );
      }
      return;
    }
    if (options.all) {
      return this.lookupAll(hostname, options);
    }
    return this.lookupOne(hostname, options);
  }

  /**
   * If {@link LookupController#bootstrap} has been called controller will stop watching for hosts file changes by calling {@link HostsFileService#stopWatching}.
   * If persistent storage has been configured with {@link LookupControllerOptions#persistentStorageService}, controller will read entire cache using {@link CacheService#entries}, serialize everything into single data object and will write it out using {@link PersistentStorageService#write}.
   *
   * @example
   * import { LookupController } from 'super-dns-lookup';
   *
   * export class Application {
   *   public constructor(
   *     protected readonly lookupController: LookupController = new LookupController(),
   *   ) {}
   *
   *   public async bootstrap() {
   *     await this.lookupController.bootstrap();
   *     // then start all other application components when lookup controller is ready
   *   }
   *
   *   public teardown() {
   *     // first stop all other application components and then
   *     await this.lookupController.bootstrap();
   *   }
   * }
   * @see {@link LookupController#bootstrap}
   * @see {@link HostsFileService#stopWatching}
   * @see {@link CacheService#entries}
   * @see {@link PersistentStorageService#write}
   * @returns Promise that teardown will complete successfully.
   */
  public async teardown() {
    this.hostsFileService.stopWatching();
  }
  protected async readHostsFile(): Promise<Map<string, LookupAddress[]>> {
    if (typeof this.hostsFileReadPromise === 'undefined') {
      this.hostsFileReadPromise = new Promise((resolve) => {
        this.hostsFileService.read().then(
          (pairs) => {
            const result = new Map<string, LookupAddress[]>();
            for (const pair of pairs) {
              const [hostname, address] = pair;
              let addresses = result.get(hostname);
              if (!addresses) {
                addresses = [];
                result.set(hostname, addresses);
              }
              if (this.isIpService.isIPv4(address)) {
                addresses.push({ address, family: 4 });
              } else if (this.isIpService.isIPv6(address)) {
                addresses.push({ address, family: 6 });
              } else {
                this.emit('error', new InvalidHostnameAddressPair(this.hostsFileService.path, pair));
              }
            }
            resolve(result);
          },
          (error) => {
            this.hostsFileReadPromise = Promise.resolve(new Map());
            this.emit('error', error);
          }
        );
      });
    }
    return this.hostsFileReadPromise;
  }

  /**
   * Checks given value to be a {@link LookupCallback} or not.
   *
   * @param value
   * @returns True when provided value is a {@link LookupCallback} and false otherwise.
   */
  protected isCallback(value: unknown): value is LookupCallback {
    return typeof value === 'function';
  }

  /**
   * Checks given value to be a {@link LookupOptions#family} or not.
   *
   * @param value
   * @returns True when provided value is a {@link LookupOptions#family} and false otherwise.
   */
  protected isFamily(value: unknown): value is LookupOptions['family'] {
    const type = typeof value;
    return type === 'number' || type === 'string';
  }

  /**
   * Checks given value to be a {@link LookupOptions} object or not.
   *
   * @param value
   * @returns True when provided value is a {@link LookupOptions} object and false otherwise.
   */
  protected isOptions(value: unknown): value is LookupOptions {
    return typeof value === 'object';
  }

  /**
   * Handles lookup request when list of addresses requested.
   *
   * @param hostname
   * @param options
   * @return List of addresses.
   */
  protected async lookupAll(hostname: string, options: Omit<LookupAllOptions, 'all'>): Promise<LookupAddress[]> {
    throw new Error('Method not implemented');
  }

  /**
   * Handles lookup request when single address requested.
   *
   * @param hostname
   * @param options
   * @return Single address.
   */
  protected async lookupOne(hostname: string, options: Omit<LookupOneOptions, 'all'>): Promise<LookupAddress> {
    throw new Error('Method not implemented');
  }
}
