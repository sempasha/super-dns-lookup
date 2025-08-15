import { ADDRCONFIG, ALL, V4MAPPED } from 'node:dns';
import type { LookupOptions as DNSLookupOptions } from 'node:dns';
import type { Agent as HttpAgent } from 'node:http';
import type { Agent as HttpsAgent } from 'node:https';
import { type CacheService, LRUCacheService } from './cache-service';
import { type HostsFileService, UniversalHostsFileService } from './hosts-file-service';
import { type IsIpService, NodeIsIpService } from './is-ip-service';
import { NodeResolverService, type ResolvedAddress, type ResolverService } from './resolver-service';
import type { PersistentStorageService } from './persistent-storage-service';
import { type ChoiceStrategy, RoundRobinChoiceStrategy } from './choice-strategy';
import { ThrottlingStrategy, UniversalThrottlingStrategy } from './throttling-strategy';
import { FailoverStrategy, UniversalFailoverStrategy } from './failover-strategy';

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

/**
 * Options of {@link LookupController}
 *
 * @group LookupController
 */
export interface LookupControllerOptions {
  /**
   * Allows to set custom {@link CacheService} which {@link LookupController} uses to store hostname resolution results and ip address check results.
   * By default {@link LRUCacheService} will be used.
   *
   * @default {@link LRUCacheService}
   */
  cacheService?: CacheService<ResolvedAddress[]>;

  /**
   * Allows to set custom {@link ChoiceStrategy} which {@link LookupController} uses to choose the only one ip of a list.
   * By default {@link RoundRobinChoiceStrategy} will be used.
   *
   * @default {@link RoundRobinChoiceStrategy}
   */
  choiceStrategy?: ChoiceStrategy;

  /**
   * Allows to set custom {@link FailoverStrategy} which {@link LookupController} uses to choose:
   *
   *  - whether to use expired cache to reply on lookup request or not;
   *  - whether to cache resolution errors or not to reduce pressure on {@link ResolverService}.
   *
   * @default {@link UniversalFailoverStrategy}
   */
  failoverStrategy?: FailoverStrategy;

  /**
   * Allows to use custom {@link HostsFileService} which allows {@link LookupController} to interact with hosts file:
   * - Read hostname/address pairs from the file;
   * - Watch for changes in the file.
   * By default {@link UniversalHostsFileService} will be used, it supports Linux, MacOS and Windows.
   *
   * @default {@link UniversalHostsFileService}
   */
  hostsFileService?: HostsFileService;

  /**
   * Allows to use custom {@link IsIpService} which helps {@link LookupController} to know whether given string an ip address or not.
   * It also identify ip address family: IPv4 or IPv6.
   * By default {@link NodeIsIpService} used.
   *
   * @default {@link NodeIsIpService}
   */
  isIpService?: IsIpService;

  /**
   * Allows to use {@link PersistentStorageService} which {@link LookupController} may use to populate initial cache during {@link LookupController#bootstrap} and write out cache data during {@link LookupController#teardown} for future use.
   * By default no persistent storage service configured, so user must provide they own implementation to get this feature works.
   *
   * @default null
   */
  persistentStorageService?: PersistentStorageService | null;

  /**
   * Allows to use custom {@link ResolverService} which {@link LookupController} uses to ask a remote resolver to resolve given hostname to ip address of different families IPv4 or IPv4.
   * By default {@link NodeResolverService} will be used.
   *
   * @default {@link NodeResolverService}
   */
  resolverService?: ResolverService;

  /**
   * Allows to use custom {@link ThrottlingStrategy} which {@link LookupController} uses to reduce load on {@link ResolverService}.
   * By default {@link UniversalThrottlingStrategy} will be used.
   * When value `null` used for this option {@link LookupController} assumes throttling is disabled.
   *
   * @default {@link UniversalThrottlingStrategy}
   */
  throttlingStrategy?: ThrottlingStrategy | null;
}

/**
 * Lookup controller itself.
 *
 * @group LookupController
 * @example // Get example.com ip address.
 * import { LookupController } from 'super-dns-lookup';
 *
 * const controller = new Controller();
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
export class LookupController {
  protected readonly cacheService: CacheService;
  protected readonly choiceStrategy: ChoiceStrategy;
  protected readonly failoverStrategy: FailoverStrategy;
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
    this.cacheService = cacheService;
    this.choiceStrategy = choiceStrategy;
    this.failoverStrategy = failoverStrategy;
    this.hostsFileService = hostsFileService;
    this.isIpService = isIpService;
    this.persistentStorageService = persistentStorageService;
    this.resolverService = resolverService;
    this.throttlingStrategy = throttlingStrategy;
  }

  /**
   * Prepares {@link LookupController} for lookup requests handling, method should be part of application bootstrap.
   * Preloads cache using {@link PersistentStorageService#read} when service provided.
   * Reads hosts file using {@link HostsFileService#read}.
   * Starts watching for hosts file using {@link HostsFileService#watch} before reading the file.
   * When {@link LookupController#lookup} has been called before {@link LookupController#bootstrap}, cache preloading and hosts file reading has been
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
    throw new Error('Method not implemented.');
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
   * Resolves hostname into ip address and resolves the returned promise with found ip address.
   * Always uses default lookup options: `all=false`, `family=0`, `hints=0` and `order="verbatim"`.
   * Rejects the returned promise in case any error has been occurred during lookup.
   *
   * Method is compatible [dns/promises.lookup](https://nodejs.org/docs/latest/api/dns.html#dnspromiseslookuphostname-options).
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @returns Promise of lookup results.
   */
  public lookup(hostname: string): Promise<LookupResult<false>>;

  /**
   * Resolves hostname into ip address and resolves the returned promise with found ip address.
   * Uses default options: `all=false`, `family=0`, `hints=0` and `order="verbatim"`, until user specified one.
   * Rejects the returned promise in case any error has been occurred during lookup.
   *
   * Method is compatible [dns/promises.lookup](https://nodejs.org/docs/latest/api/dns.html#dnspromiseslookuphostname-options).
   *
   * {@label PROMISE}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @returns Promise of lookup results.
   */
  public lookup<All extends boolean | undefined = undefined>(
    hostname: string,
    options: LookupOptions<All>
  ): Promise<LookupResult<All>>;

  /**
   * Resolves hostname into ip address and call `callback` function with found ip address as second argument.
   * Always uses default lookup options: `all=false`, `family=0`, `hints=0` and `order="verbatim"`.
   * Calls `callback` function occurred error as first argument and undefined second argument.
   *
   * Method is compatible [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback).
   *
   * {@label CALLBACK}
   * @param hostname Hostname to resolve.
   * @param callback Lookup result or error handler.
   */
  public lookup<All extends boolean | undefined = undefined>(hostname: string, callback: LookupCallback<All>): void;

  /**
   * Resolves hostname into ip address and call `callback` function with found ip address as second argument.
   * Uses default lookup options: `all=false`, `family=0`, `hints=0` and `order="verbatim"` until user specified one.
   * Calls `callback` function occurred error as first argument and undefined second argument.
   *
   * Method is compatible [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback).
   *
   * {@label CALLBACK}
   * @param hostname Hostname to resolve.
   * @param options Lookup options.
   * @param callback Lookup result or error handler.
   */
  public lookup<All extends boolean | undefined = undefined>(
    hostname: string,
    options: LookupOptions<All>,
    callback: LookupCallback<All>
  ): void;

  /**
   * 4. cache;
   * 5. resolver;
   * 6. cache resolve result;
   * 7. expired cache
   *
   * Supports all the options NodeJS built-in [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback) has, checkout {@link LookupOptions}.
   * Check whether given `hostname` is an ip address using {@link IsIpService#isIPv4} or {@link IsIpService#isIPv6} and return it when `hostname` is an ip address and address family does not conflict with {@link LookupOptions#family}.
   * Cache result of check, whether `hostname` is an ip address, and use cache in subsequent for subsequent lookups.
   * When provided `hostname` is an ip address of IPv4 family, {@link LookupOptions#family} tells to look for IPv6 addresses and {@link LookupOptions#hints} has `dns.V4MAPPED` flag set, then lookup ends up with IPv4 address mapped to IPv6.
   * When provided `hostname` is an ip address and it does not match provided lookup options, controller throws `dns.NOTFOUND` [error](https://nodejs.org/api/dns.html#error-codes).
   * When given `hostname` is not an ip address then controller tries to resolve it with hosts file data.
   * When given `hostname` can't be resolved using hosts file data, controller tries to resolve it using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on specified options.
   * Stores result of {@link ResolverService#resolve4} and {@link ResolverService#resolve6} and subsequent lookup requests for given `hostname` will be processed using data from cache, this way controller avoids excessive dns requests.
   * When controller has has only actual cache data for given `hostname` and `options`, controller will reply using data from cache.
   * When controller has only expired cache data for given `hostname` and `options`, controller will do `hostname` resolution (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`), save resolution results in cache and will reply using fresh resolution result.
   * When controller has both actual and expired cache data for given `hostname` and `options`, controller will reply using actual data only and perform background `hostname` resolution (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`) to refresh cache.
   * When controller has only expired cache data for given `hostname` and `options`, `hostname` resolution attempt (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`) has been failed with some error, controller rejects lookup request if {@link FailoverStrategy#useExpiredCache} tells to do so.
   * When {@link FailoverStrategy#useExpiredCache} tells to use expired cache {@link LookupController} should use expired cache but only cache which expired less then ``.
   * When {@link FailoverStrategy#useExpiredCache} tells to use expired cache {@link LookupController} should use expired cache but only when there is a cache expired less then `maxExpirationMs` ago.
   * When resolution of hostname (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`) has been failed controller should not cache resolution error until {@link FailoverStrategy#cacheResolverFailure} tells to do so.
   * When {@link FailoverStrategy#cacheResolverFailure} tells to cache resolution error, controller must store error in cache and use it to reject all subsequent lookup requests for given `hostname` during next `ttlMs` without attempting to resolve `hostname` again.
   * Decision of {@link FailoverStrategy#useExpiredCache} should take a precedence over rejecting request with cached resolution error.
   * Controller should use throttled resolution methods ({@link ResolverService#resolve4} or {@link ResolverService#resolve6} depending on `options`) created by {@link ThrottlingStrategy#throttleResolve} when {@link ThrottlingStrategy} has been configured.
   *
   * This overload is compatible with both [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback) and [dns/promises.lookup](https://nodejs.org/docs/latest/api/dns.html#dnspromiseslookuphostname-options) versions.
   *
   * @param hostname Hostname to resolve.
   * @param optionsOrCallback Depending on used signature here may be an options or callback function or nothing.
   * @param maybeCallback Depending on used signature here may be callback function or nothing.
   * @returns Depending on used signature it may be nothing (when callback used) or promise of lookup result (when no callback used).
   */
  public lookup<All extends boolean | undefined = undefined>(
    hostname: string,
    optionsOrCallback?: LookupOptions<All> | LookupCallback<All> | undefined,
    maybeCallback?: LookupCallback<All> | undefined
  ): Promise<LookupResult<All>> | void {
    throw new Error('Method not implemented.');
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
    throw new Error('Method not implemented.');
  }
}
