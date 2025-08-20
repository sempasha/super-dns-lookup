import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { CacheService, LRUCacheService } from '../cache-service';
import { ChoiceStrategy, RoundRobinChoiceStrategy } from '../choice-strategy';
import { FailoverStrategy, UniversalFailoverStrategy } from '../failover-strategy';
import { HostsFileService, UniversalHostsFileService } from '../hosts-file-service';
import { IsIpService, NodeIsIpService } from '../is-ip-service';
import { PersistentStorageService } from '../persistent-storage-service';
import { NodeResolverService, ResolverService } from '../resolver-service';
import { ThrottlingStrategy, UniversalThrottlingStrategy } from '../throttling-strategy';
import { LookupCallback } from './lookup-callback';
import { LookupControllerOptions } from './lookup-controller-options';
import { LookupOptions } from './lookup-options';
import { LookupResult } from './lookup-result';

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
   * Supports all the options NodeJS built-in [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback) has, checkout {@link LookupOptions}.
   * Check whether given `hostname` is an ip address using {@link IsIpService#isIPv4} or {@link IsIpService#isIPv6} and return it when `hostname` is an ip address and address family does not conflict with {@link LookupOptions#family}.
   * Cache result of check, whether `hostname` is an ip address, and use cache in subsequent for subsequent lookups.
   * When provided `hostname` is an ip address of IPv4 family, {@link LookupOptions#family} tells to look for IPv6 addresses and {@link LookupOptions#hints} has `dns.V4MAPPED` flag set, then lookup ends up with IPv4 address mapped to IPv6.
   * When provided `hostname` is an ip address and it does not match provided lookup options, controller throws `dns.NOTFOUND` [error](https://nodejs.org/api/dns.html#error-codes).
   * When given `hostname` is not an ip address then controller tries to resolve it with hosts file data.
   * When given `hostname` can't be resolved using hosts file data, controller tries to resolve it using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on specified options.
   * Stores result of {@link ResolverService#resolve4} and {@link ResolverService#resolve6} for given `hostname` in cache using {@link CacheService#set} to use cached data for subsequent lookup requests processing.
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
