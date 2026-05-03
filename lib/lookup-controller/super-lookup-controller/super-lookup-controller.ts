import { ADDRCONFIG, ALL, getDefaultResultOrder, V4MAPPED } from 'node:dns';
import { EventEmitter } from 'node:events';
import { type Agent as HttpAgent } from 'node:http';
import { type Agent as HttpsAgent } from 'node:https';
import { isIPv4, isIPv6 } from 'node:net';
import { networkInterfaces } from 'node:os';
import { type CacheService, LRUCacheService } from '../../cache-service';
import { type ChoiceStrategy, RoundRobinChoiceStrategy } from '../../choice-strategy';
import { type FailoverStrategy, UniversalFailoverStrategy } from '../../failover-strategy';
import {
  HostnameAddressPair,
  HostsFileNotReadable,
  type HostsFileService,
  UniversalHostsFileService
} from '../../hosts-file-service';
import { type IsIpService, NodeIsIpService } from '../../is-ip-service';
import { type PersistentStorageService } from '../../persistent-storage-service';
import { NodeResolverService, type ResolverService } from '../../resolver-service';
import { type ThrottlingStrategy, UniversalThrottlingStrategy } from '../../throttling-strategy';
import {
  type LookupAddress,
  type LookupAllCallback,
  type LookupAllOptions,
  type LookupCallback,
  type LookupController,
  type LookupOneCallback,
  type LookupOneOptions,
  type LookupOptions
} from '../lookup-controller';
import { AddrConfigConflict, InvalidHostnameAddressPair, LookupError } from './errors';
import {
  type SuperLookupControllerLibcCompatibilityName,
  type SuperLookupControllerOptions
} from './super-lookup-controller-options';
import {
  type AddressFamily,
  type AddressRecord,
  type AllOptions,
  FamilyRecord,
  HostnameRecord,
  type ResolveOptions,
  type ResolveResult,
  type ResponseOptions,
  isHostnameRecordJson,
  mapIPv4toIPv6
} from './util';

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
export class SuperLookupController extends EventEmitter<{ error: [unknown] }> implements LookupController {
  protected readonly cacheService: CacheService<HostnameRecord> | null;
  protected readonly choiceStrategy: ChoiceStrategy | null;
  protected readonly failoverStrategy: FailoverStrategy | null;
  protected readonly hostsFileService: HostsFileService | null;
  protected readonly isIpService: IsIpService | null;
  protected readonly lazyBootstrap: boolean;
  protected readonly lazyTeardown: false | NodeJS.Signals[];
  protected readonly libcCompatibilityName: SuperLookupControllerLibcCompatibilityName | null;
  protected readonly persistentStorageService: PersistentStorageService | null;
  protected readonly resolverService: ResolverService | null;
  protected readonly throttlingStrategy: ThrottlingStrategy | null;
  protected readonly verbatimOrder: Required<SuperLookupControllerOptions>['verbatimOrder'];
  protected hostsFileReadPromise: Promise<Map<string, ResolveResult>> | null = null;
  protected bootstrapPromise: Promise<void> | undefined;
  protected teardownPromise: Promise<void> | undefined;

  /**
   * Creates {@link LookupController} with given options.
   *
   * @example // Create LookupController with all default options
   * import { SuperLookupController } from 'super-dns-lookup';
   *
   * const controller = new SuperLookupController();
   * @example // Create LookupController with increased cache
   * import { SuperLookupController, LRUCacheService } from 'super-dns-lookup';
   *
   * const cacheService = new LRUCacheService({ maxHostnames: 10_000 });
   * const controller = new SuperLookupController({ cacheService });
   * @param options Controller options which is better not to ignore.
   */
  public constructor({
    cacheService = new LRUCacheService(),
    choiceStrategy = new RoundRobinChoiceStrategy(),
    lazyBootstrap = false,
    lazyTeardown = false,
    libcCompatibilityName = null,
    failoverStrategy = new UniversalFailoverStrategy(),
    hostsFileService = new UniversalHostsFileService(),
    isIpService = new NodeIsIpService(),
    persistentStorageService = null,
    resolverService = new NodeResolverService(),
    throttlingStrategy = new UniversalThrottlingStrategy(),
    verbatimOrder = 'ipv4first'
  }: SuperLookupControllerOptions = {}) {
    super();
    this.cacheService = cacheService as CacheService<HostnameRecord>;
    this.choiceStrategy = choiceStrategy;
    this.failoverStrategy = failoverStrategy;
    this.hostsFileService = hostsFileService;
    this.isIpService = isIpService;
    this.lazyBootstrap = lazyBootstrap;
    this.lazyTeardown = lazyTeardown;
    this.libcCompatibilityName = libcCompatibilityName;
    this.persistentStorageService = persistentStorageService;
    this.resolverService = resolverService;
    this.throttlingStrategy = throttlingStrategy;
    this.verbatimOrder = verbatimOrder;
    if (this.hostsFileService) {
      this.hostsFileService.on('error', (error) => {
        this.emit('error', error);
      });
    }
    this.lookup = this.lookup.bind(this);
    this.teardown = this.teardown.bind(this);
  }

  /**
   * Prepares {@link LookupController} for lookup requests handling, method should be part of application bootstrap.
   * Preloads cache using {@link PersistentStorageService#read} when service provided.
   * Reads hosts file using {@link HostsFileService#read}.
   * Starts watching for hosts file using {@link HostsFileService#watch} before reading the file.
   * While watching {@link LookupController} should read hosts file on every hosts file change.
   * While reading hosts file data, {@link LookupController} should consider {@link HostsFileNotFound} as a signal to forget all the data previously loaded from hosts file.
   * Error {@link HostsFileNotReadable} should be considered as a signal to stop reading file and keep previously read data.
   * Enables process event listeners specified by {@link SuperLookupControllerOptions#lazyTeardown} option which will trigger {@link SuperLookupController#teardown}.
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
  public async bootstrap() {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }
    const teardownPromise = this.teardownPromise ?? Promise.resolve();
    this.teardownPromise = undefined;
    this.bootstrapPromise = teardownPromise.then(() => {
      if (this.lazyTeardown) {
        for (const signal of this.lazyTeardown) {
          process.once(signal, this.teardown);
        }
      }
      this.hostsFileService?.watch(() => {
        this.readHostsFile(true);
      });
      return Promise.all([this.readHostsFile(), this.readPersistentStorage()]).then();
    });
    return this.bootstrapPromise;
  }

  /**
   * Reads all hostname/address pairs from hosts file.
   * When pair has unrecognizable address, skips the pair and emits {@link InvalidHostnameAddressPair} error.
   * When {@link HostsFileService#read} has been rejected with error, assumes hosts file is empty and emits reading error.
   * Method supposed to be called as the very first step of {@link LookupController#bootstrap}.
   * Method supposed to be called on every hosts file update.
   *
   * @param force Force read file again.
   * @returns Promise of all hostname/address pairs found in hosts file.
   */
  protected async readHostsFile(force = false): Promise<Map<string, ResolveResult>> {
    if (force || !this.hostsFileReadPromise) {
      const emptyMap = new Map();
      const lastPromise = this.hostsFileReadPromise ?? Promise.resolve(emptyMap);
      this.hostsFileReadPromise = new Promise((resolve) => {
        lastPromise.then((fallback) => {
          const result = new Map<string, ResolveResult>();

          const { hostsFileService } = this;

          if (!hostsFileService) {
            resolve(result);
            return;
          }

          const handleReject = (error: unknown) => {
            this.emit('error', error);
            if (error instanceof HostsFileNotReadable) {
              resolve(fallback);
            } else {
              resolve(emptyMap);
            }
          };

          const handleResolve = (pairs: HostnameAddressPair[]) => {
            const isIpService = this.isIpService || { isIPv4, isIPv6 };

            for (const pair of pairs) {
              const [hostname, address] = pair;
              let record = result.get(hostname);
              if (!record) {
                record = {};
                result.set(hostname, record);
              }
              if (isIpService.isIPv4(address)) {
                if (record[4]) {
                  record[4].push({ address });
                } else {
                  record[4] = [{ address }];
                }
              } else if (isIpService.isIPv6(address)) {
                if (record[6]) {
                  record[6].push({ address });
                } else {
                  record[6] = [{ address }];
                }
              } else {
                this.emit('error', new InvalidHostnameAddressPair(hostsFileService.path, pair));
              }
            }
            resolve(result);
          };

          try {
            hostsFileService.read().then(handleResolve, handleReject);
          } catch (error) {
            handleReject(error);
          }
        });
      });
    }
    return this.hostsFileReadPromise;
  }

  /**
   * Reads initial cache data using {@link PersistentStorageService} and populates {@link CacheService}.
   * When {@link SuperLookupControllerOptions#cacheService} or {@link SuperLookupControllerOptions#persistentStorageService} have not been set, does nothing.
   * When records read from {@link PersistentStorageService} do not match the {@link HostnameRecord} interface that {@link CacheService} expects, they are skipped.
   * @returns Promise data to be read and cache to be populated.
   */
  protected async readPersistentStorage(): Promise<void> {
    const { cacheService, persistentStorageService } = this;
    if (cacheService && persistentStorageService) {
      const data = await persistentStorageService.read();
      if (Array.isArray(data)) {
        const isIpService = this.isIpService || { isIPv4, isIPv6 };
        for (const item of data) {
          if (Array.isArray(item) && item.length >= 2) {
            const [key, value] = item;
            if (typeof key === 'string' && isHostnameRecordJson(value)) {
              const { 4: ipv4, 6: ipv6 } = value;
              if (ipv4 && ipv4.actual) {
                ipv4.actual = ipv4.actual.filter(({ address }) => isIpService.isIPv4(address));
              }
              if (ipv6 && ipv6.actual) {
                ipv6.actual = ipv6.actual.filter(({ address }) => isIpService.isIPv6(address));
              }
              if ((ipv4?.actual?.length ?? 0) + (ipv6?.actual?.length ?? 0) > 0) {
                cacheService.set(key, new HostnameRecord(value));
              }
            }
          }
        }
      }
    }
  }

  /**
   * If {@link LookupController#bootstrap} has been called, controller will stop watching for hosts file changes by calling {@link HostsFileService#stopWatching}.
   * If persistent storage has been configured with {@link SuperLookupControllerOptions#persistentStorageService}, controller will read entire cache using {@link CacheService#entries}, serialize everything into single data object and will write it out using {@link PersistentStorageService#write}.
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
  public async teardown() {
    if (this.teardownPromise) {
      return this.teardownPromise;
    }
    const bootstrapPromise = this.bootstrapPromise;
    if (!bootstrapPromise) {
      return;
    }
    this.bootstrapPromise = undefined;
    this.teardownPromise = bootstrapPromise.then(() => {
      if (this.lazyTeardown) {
        for (const signal of this.lazyTeardown) {
          process.off(signal, this.teardown);
        }
      }
      if (this.hostsFileService) {
        this.hostsFileService.stopWatching();
      }
      return this.writePersistentStorage();
    });
    return this.teardownPromise;
  }

  /**
   * Writes data stored in {@link CacheService} to {@link PersistentStorageService}.
   * When {@link SuperLookupControllerOptions#persistentStorageService} has not been set, does nothing.
   */
  protected async writePersistentStorage(): Promise<void> {
    const { cacheService, persistentStorageService } = this;
    if (cacheService && persistentStorageService) {
      const data: [string, unknown][] = [];
      for (const [family, record] of cacheService.entries()) {
        data.push([family, record.toJSON()]);
      }
      await persistentStorageService.write(data);
    }
  }

  /**
   * Makes [http.Agent](https://nodejs.org/docs/latest/api/http.html#class-httpagent) or [https.Agent](https://nodejs.org/docs/latest/api/https.html#class-httpsagent) to use {@link LookupController#lookup} to resolve hostname when agent creates new [connection](https://nodejs.org/docs/latest/api/http.html#agentcreateconnectionoptions-callback).
   *
   * @param agent [http.Agent](https://nodejs.org/docs/latest/api/http.html#class-httpagent) or [https.Agent](https://nodejs.org/docs/latest/api/https.html#class-httpsagent) where {@link LookupController#lookup} must be installed and used as `lookup` option during [createConnection](https://nodejs.org/docs/latest/api/http.html#agentcreateconnectionoptions-callback) call.
   */
  public install(agent: HttpAgent | HttpsAgent) {
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
   * When {@link FailoverStrategy#useExpiredCache} instructs to use expired cache, {@link LookupController} should use expired cache but only when there is cache that expired less than `maxExpirationMs` ago.
   * When the resolution of the hostname (using {@link ResolverService#resolve4} and/or {@link ResolverService#resolve6} depending on `options`) has failed, the controller should not cache the resolution error until {@link FailoverStrategy#cacheResolverFailure} instructs to do so.
   * When {@link FailoverStrategy#cacheResolverFailure} instructs to cache the resolution error, the controller must store the error in the cache and use it to reject all subsequent lookup requests for the given `hostname` during the next `ttlMs` without attempting to resolve the `hostname` again.
   * Gives precedence to the decision of {@link FailoverStrategy#useExpiredCache} to use expired cache rather than rejecting requests with cached resolution errors.
   * Uses only throttled version of resolution methods ({@link ResolverService#resolve4} or {@link ResolverService#resolve6} depending on `options`) created by {@link ThrottlingStrategy#throttle}.
   * Creates its own throttled version of the resolution method for each given hostname that needs to be resolved.
   * Reuses the throttled resolution method when one has already been created.
   * Forgets the throttled resolution method right after all promises created by the throttled method have been resolved, i.e., resolution requests have been completed.
   * Compatible with both [dns.lookup](https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback) and [dns/promises.lookup](https://nodejs.org/docs/latest/api/dns.html#dnspromiseslookuphostname-options) resolution methods.
   * Method is hard bound to {@link SuperLookupController} instance.
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
    let lookupOptions: LookupOptions;

    if (this.isLookupCallback(maybeCallback)) {
      callback = maybeCallback;
    } else if (this.isLookupCallback(optionsOrFamilyOrCallback)) {
      callback = optionsOrFamilyOrCallback;
    }
    if (this.isLookupOptionsFamily(optionsOrFamilyOrCallback)) {
      lookupOptions = { family: optionsOrFamilyOrCallback };
    } else if (this.isLookupOptions(optionsOrFamilyOrCallback)) {
      lookupOptions = optionsOrFamilyOrCallback;
    } else {
      lookupOptions = {};
    }

    // glibc implementation of getaddrinfo tend to preset ENODATA as EAI_AGAIN.
    // musl implementation of getaddrinfo tend to preset ENODATA as ENOTFOUND.
    const makeErrorLibcCompatible = <T>(error: T): T => {
      if (error instanceof LookupError) {
        if (error.code === 'ENODATA') {
          switch (this.libcCompatibilityName) {
            case 'glibc':
              Object.assign(error, { code: 'EAI_AGAIN' });
              break;
            case 'musl':
              Object.assign(error, { code: 'ENOTFOUND' });
              break;
          }
        } else if (error.cause instanceof AddrConfigConflict) {
          switch (this.libcCompatibilityName) {
            case 'glibc':
            case 'musl':
              Object.assign(error, { code: 'ENOTFOUND' });
              break;
          }
        }
      }
      return error;
    };

    let allOptions: AllOptions;
    try {
      const { resolve, response } = this.parseLookupOptions(lookupOptions);
      allOptions = { lookup: lookupOptions, resolve, response, requestTime: Date.now() };
    } catch (error) {
      const lookupError = makeErrorLibcCompatible(new LookupError(hostname, lookupOptions, error));
      if (callback) {
        return callback(lookupError);
      } else {
        return Promise.reject(lookupError);
      }
    }

    const lazyBootstrap = this.lazyBootstrap ? this.bootstrap() : Promise.resolve();
    if (lookupOptions.all) {
      const promise = lazyBootstrap.then(() => this.lookupAll(hostname, allOptions));
      if (callback) {
        promise.then(
          (result) => callback(null, result),
          (error) => callback(makeErrorLibcCompatible(error))
        );
      } else {
        return promise.catch((error) => {
          throw makeErrorLibcCompatible(error);
        });
      }
    } else {
      const promise = lazyBootstrap.then(() => this.lookupOne(hostname, allOptions));
      if (callback) {
        promise.then(
          ({ address, family }) => callback(null, address, family),
          (error) => callback(makeErrorLibcCompatible(error))
        );
      } else {
        return promise.catch((error) => {
          throw makeErrorLibcCompatible(error);
        });
      }
    }
  }

  /**
   * Checks given value to be a {@link LookupCallback} or not.
   *
   * @param value
   * @returns True when provided value is a {@link LookupCallback} and false otherwise.
   */
  protected isLookupCallback(value: unknown): value is LookupCallback {
    return typeof value === 'function';
  }

  /**
   * Checks given value to be a {@link LookupOptions#family} or not.
   *
   * @param value
   * @returns True when provided value is a {@link LookupOptions#family} and false otherwise.
   */
  protected isLookupOptionsFamily(value: unknown): value is LookupOptions['family'] {
    const type = typeof value;
    return type === 'number' || type === 'string';
  }

  /**
   * Checks given value to be a {@link LookupOptions} object or not.
   *
   * @param value
   * @returns True when provided value is a {@link LookupOptions} object and false otherwise.
   */
  protected isLookupOptions(value: unknown): value is LookupOptions {
    return typeof value === 'object';
  }

  /**
   * Performs {@link LookupOptions} parsing into {@link ResolveOptions} and {@link ResponseOptions}.
   * Value of {@link ResolveOptions#family} would be defined based on {@link LookupOptions#family}.
   * Value of {@link ResolveOptions#family} would include both 4 and 6 ip address families, when value of {@link LookupOptions#family} has not been specified.
   * List of {@link ResolveOptions#family} would be limited by configured network interfaces, when `ADDRCONFIG` {@link LookupOptions#hints|hint} has been set.
   * Value of {@link ResponseOptions#family} would be the same as {@link ResolveOptions#family} in most cases.
   * List of {@link ResponseOptions#family} would include alternative v4 mapped address family, when `V4MAPPED` {@link LookupOptions#hints|hint} has been set.
   * List of {@link ResponseOptions#family} would include additional v4 mapped address family, when both `ALL` and `V4MAPPED` {@link LookupOptions#hints|hints} has been set.
   * Value of {@link ResponseOptions#order} is the same as {@link LookupOptions#order}.
   * Value of {@link ResponseOptions#order} calculated based on {@link LookupOptions#verbatim}, when {@link LookupOptions#order} has not been specified.
   * Value of {@link ResponseOptions#order} would be `'verbatim'`, when nor {@link LookupOptions#order}, nor {@link LookupOptions#verbatim} specified.
   *
   * @param options Original lookup options.
   * @returns Both {@link ResolveOptions} and {@link ResponseOptions}.
   */
  protected parseLookupOptions(options: LookupOptions): {
    resolve: ResolveOptions;
    response: ResponseOptions;
  } {
    const resolveFamily = new Set<AddressFamily>();
    const resolve: ResolveOptions = {
      family: resolveFamily
    };
    const response: ResponseOptions = {
      family: resolveFamily,
      mapped: 'no',
      order: this.getDefaultResultOrder()
    };
    if (options.family === 'IPv4' || options.family === 4) {
      resolveFamily.add(4);
    } else if (options.family === 'IPv6' || options.family === 6) {
      resolveFamily.add(6);
    } else {
      resolveFamily.add(4).add(6);
    }
    if (options.hints) {
      if ((options.hints & ADDRCONFIG) === ADDRCONFIG) {
        const availableFamilies = this.getAddrConfigFamilies();
        for (const family of resolveFamily) {
          if (!availableFamilies.has(family)) {
            resolveFamily.delete(family);
          }
        }
        if (resolveFamily.size === 0) {
          throw new AddrConfigConflict(options, availableFamilies);
        }
      }
      if (resolveFamily.size === 1 && resolveFamily.has(6) && (options.hints & V4MAPPED) === V4MAPPED) {
        response.family = new Set(resolveFamily);
        resolveFamily.add(4);
        response.mapped = (options.hints & ALL) === ALL ? 'yes' : 'when_no_6';
      }
    }
    if (options.order && options.order !== 'verbatim') {
      response.order = options.order;
    } else if (typeof options.verbatim === 'boolean') {
      response.order = options.verbatim ? this.verbatimOrder : 'ipv4first';
    }
    return { resolve, response };
  }

  /**
   * Detect default result order.
   * Utilizes [dns.getDefaultResultOrder](https://nodejs.org/docs/latest/api/dns.html#dnsgetdefaultresultorder).
   * @returns
   */
  protected getDefaultResultOrder(): 'ipv4first' | 'ipv6first' {
    const order = getDefaultResultOrder();
    return order === 'verbatim' ? this.verbatimOrder : order;
  }

  /**
   * Detect IP address families available in system by looking at network interfaces.
   * Utilizes [os.networkInterfaces](https://nodejs.org/docs/latest/api/os.html#osnetworkinterfaces).
   *
   * @returns Set of available IP families.
   */
  protected getAddrConfigFamilies(): Set<AddressFamily> {
    const families: Set<AddressFamily> = new Set();

    for (const interfaces of Object.values(networkInterfaces())) {
      for (const { family, internal } of interfaces || []) {
        if (!internal) {
          families.add(family === 'IPv4' ? 4 : 6);
          if (families.size === 2) {
            break;
          }
        }
      }
    }
    return families;
  }

  /**
   * Handles lookup request when list of addresses requested.
   * First its resolves hostname to all possible addresses using {@link LookupController#resolve} (with respect to the {@link LookupOptions#family}).
   * And returns resolved addresses according to specified {@link LookupOptions#family}, {@link LookupOptions#hints} and {@link LookupOptions#order}.
   * When there is no appropriate address, throws {@link LookupError} with code NOTFOUND error.
   *
   * @param hostname Hostname to resolve.
   * @param options Normalized lookup options.
   * @return List of found IP addresses.
   * @throws {@link LookupError} when nothing found or subsequential resolve request(s) failed.
   */
  protected async lookupAll(hostname: string, options: AllOptions): Promise<LookupAddress[]> {
    const hostnameRecord = await this.resolve(hostname, options);
    const addresses: LookupAddress[] = [];
    const add4Family = () => {
      if (options.response.family.has(4) && hostnameRecord[4]) {
        const familyRecord = hostnameRecord[4];
        for (const addressRecord of familyRecord) {
          addresses.push({ address: addressRecord.address, family: 4 });
        }
      }
    };
    const add6Family = () => {
      if (options.response.family.has(6) && hostnameRecord[6]) {
        const familyRecord = hostnameRecord[6];
        for (const addressRecord of familyRecord) {
          addresses.push({ address: addressRecord.address, family: 6 });
        }
      }
    };
    const addMapped = () => {
      const useMapped =
        options.response.mapped === 'yes' || (options.response.mapped === 'when_no_6' && !hostnameRecord[6]?.length);
      if (useMapped && hostnameRecord[4]) {
        for (const addressRecord of hostnameRecord[4]) {
          addresses.push({ address: mapIPv4toIPv6(addressRecord), family: 6 });
        }
      }
    };
    const addFamilies =
      options.response.order === 'ipv4first'
        ? [add4Family, addMapped, add6Family]
        : [addMapped, add6Family, add4Family];

    for (const addFamily of addFamilies) {
      addFamily();
    }
    if (addresses.length > 0) {
      return addresses;
    }
    throw new LookupError(hostname, options.lookup, 'NOTFOUND');
  }

  /**
   * Handles lookup request when single address requested.
   *
   * @param hostname Hostname to resolve.
   * @param options Normalized lookup options.
   * @return One of found IP addresses.
   */
  protected async lookupOne(hostname: string, options: AllOptions): Promise<LookupAddress> {
    const hostnameRecord = await this.resolve(hostname, options);
    const chooseOne = this.choiceStrategy
      ? this.choiceStrategy.chooseOne.bind(this.choiceStrategy)
      : <T>(items: T[]): T => items[0]!;
    const choose4Family = () => {
      if (options.response.family.has(4) && hostnameRecord[4]?.length) {
        const addressRecord = chooseOne(hostnameRecord[4]);
        return { address: addressRecord.address, family: 4 };
      }
    };
    const choose6Family = () => {
      if (options.response.family.has(6) && hostnameRecord[6]) {
        const addressRecord = chooseOne(hostnameRecord[6]);
        return { address: addressRecord.address, family: 6 };
      }
    };
    const chooseMapped = () => {
      const useMapped =
        options.response.mapped === 'yes' || (options.response.mapped === 'when_no_6' && !hostnameRecord[6]?.length);
      if (useMapped && hostnameRecord[4]) {
        const addressRecord = chooseOne(hostnameRecord[4]);
        return { address: mapIPv4toIPv6(addressRecord), family: 6 };
      }
    };

    // TODO: Apply chooseOne to chooseFamilies to make sure all possible families will be used.
    const chooseFamilies =
      options.response.order === 'ipv4first'
        ? [choose4Family, choose6Family, chooseMapped]
        : [choose6Family, chooseMapped, choose4Family];

    for (const chooseFamily of chooseFamilies) {
      const address = chooseFamily();
      if (address) {
        return address;
      }
    }
    throw new LookupError(hostname, options.lookup, 'NOTFOUND');
  }

  /**
   * Resolves hostname into IP addresses of requested families.
   * Tries different resolution methods:
   *
   *  - Firstly tries to resolve with {@link IsIpService};
   *  - Next tries to resolve with {@link HostsFileService};
   *  - And lastly tries to resolve with {@link ResolverService}.
   *
   * Throws {@link LookupError} with ENODATA code when nothing found.
   *
   * @param hostname Hostname to resolve.
   * @param options Some of normalized lookup options.
   * @returns Resolved addresses for each requested family.
   */
  /**
   * Resolves hostname using all available resolution strategies.
   * Tries to resolve via {@link IsIpService}, then via {@link HostsFileService}, and finally via {@link ResolverService}.
   *
   * @param hostname Hostname to resolve.
   * @param options All options containing lookup, resolve, and requestTime.
   * @returns Resolved hostname record.
   * @throws {@link LookupError} when resolution fails.
   */
  protected async resolve(
    hostname: string,
    options: Pick<AllOptions, 'lookup' | 'resolve' | 'requestTime'>
  ): Promise<ResolveResult> {
    if (!this.cacheService?.get(hostname)) {
      this.cacheService?.set(hostname, new HostnameRecord());
    }
    const resolvers = [
      () => this.tryResolveViaIsIpService(hostname, options),
      () => this.tryResolveViaHostsFileService(hostname, options),
      () => this.tryResolveViaResolverService(hostname, options)
    ];
    for (const resolver of resolvers) {
      const resolvedHostnameRecord = await resolver();
      if (resolvedHostnameRecord) {
        return resolvedHostnameRecord;
      }
    }
    throw new LookupError(hostname, options.lookup, 'ENOTFOUND');
  }

  /**
   * Represents attempt to resolve given hostname with {@link IsIpService}.
   *
   * @param hostname Hostname to resolve.
   * @param options Resolve options.
   * @returns Resolution result in case provided hostname is an IP address.
   */
  protected tryResolveViaIsIpService(
    hostname: string,
    options: Pick<AllOptions, 'resolve'>
  ): ResolveResult | undefined {
    const { cacheService, isIpService } = this;
    if (!isIpService) {
      return;
    }
    const hostnameRecord = cacheService?.get(hostname);
    if (!hostnameRecord) {
      return;
    }
    for (const family of options.resolve.family) {
      let familyRecord = hostnameRecord[family];
      if (!familyRecord) {
        hostnameRecord[family] = familyRecord = new FamilyRecord();
      }
      if (typeof familyRecord.isIp === 'undefined') {
        familyRecord.isIp = isIpService[`isIPv${family}`](hostname);
      }
      if (familyRecord.isIp) {
        return { [family]: [{ address: hostname }] };
      }
    }
  }

  /**
   * Represents attempt to resolve given hostname with data read from {@link HostsFileService}.
   *
   * @param hostname Hostname to resolve.
   * @param options Resolve options.
   * @returns Resolution result in case provided hostname found in hosts file.
   */
  protected async tryResolveViaHostsFileService(
    hostname: string,
    options: Pick<AllOptions, 'resolve'>
  ): Promise<ResolveResult | undefined> {
    if (this.hostsFileService) {
      const hostsFileData = await this.readHostsFile();
      const hostsFileRecord = hostsFileData.get(hostname);
      if (hostsFileRecord) {
        for (const family of options.resolve.family) {
          const familyRecord = hostsFileRecord[family];
          if (familyRecord && familyRecord.length > 0) {
            return hostsFileRecord;
          }
        }
      }
    }
  }

  /**
   * Represents attempt to resolve given hostname with {@link ResolverService}.
   *
   * @param hostname Hostname to resolve.
   * @param options Options containing lookup, resolve, and requestTime.
   * @returns Resolution result or undefined.
   */
  protected async tryResolveViaResolverService(
    hostname: string,
    options: Pick<AllOptions, 'lookup' | 'resolve' | 'requestTime'>
  ): Promise<ResolveResult | undefined> {
    if (!this.resolverService) {
      return;
    }
    const families: AddressFamily[] = [];
    const promises: Promise<ResolveResult['4'] | ResolveResult['6']>[] = [];
    for (const family of options.resolve.family) {
      families.push(family);
      try {
        const addresses = this.tryResolveFamilyViaCacheService(hostname, family, options.requestTime);
        if (addresses && addresses.length > 0) {
          promises.push(Promise.resolve(addresses));
        } else {
          promises.push(this.tryResolveFamilyViaResolverService(hostname, family, options.requestTime));
        }
      } catch (error) {
        promises.push(Promise.reject(error));
      }
    }
    const errors: unknown[] = [];
    const result: ResolveResult = {};
    for (const settled of await Promise.allSettled(promises)) {
      const family = families.shift()!;
      if (settled.status === 'fulfilled') {
        result[family] = settled.value;
      } else {
        errors.push(settled.reason);
      }
    }
    if ((result[4] && result[4].length > 0) || (result[6] && result[6].length > 0)) {
      return result;
    }
    if (errors.length === options.resolve.family.size) {
      throw new LookupError(hostname, options.lookup, errors);
    }
  }

  /**
   * Attempts to get resolution result from {@link CacheService} for specific address family.
   * Method supports not only address cache, but error cache as well.
   * When there is no actual addresses, but actual error found, error will be thrown.
   * Before throwing actual error, there will be attempt to apply {@link FailoverStrategy#useExpiredCache} for the error.
   *
   * @param hostname Hostname to resolve.
   * @param family Address family (4 or 6).
   * @param requestTime Time of the lookup request.
   * @returns Cached addresses or undefined.
   */
  protected tryResolveFamilyViaCacheService(
    hostname: string,
    family: AddressFamily,
    requestTime: number
  ): ResolveResult['4'] | ResolveResult['6'] {
    const hostnameRecord = this.cacheService?.get(hostname);
    if (!hostnameRecord) {
      return;
    }
    const familyRecord = hostnameRecord[family];
    if (!familyRecord) {
      return;
    }
    familyRecord.updateActual(requestTime);
    const { actual, error } = familyRecord;
    if (actual && actual.length > 0) {
      return actual;
    }
    if (error && error.expiresAt > requestTime) {
      return this.fallbackToExpiredAddresses(hostname, familyRecord, requestTime, error.error);
    }
    return;
  }

  /**
   * Attempts to resolve hostname via {@link ResolverService} for specific address family.
   * Uses throttled resolution method and handles caching of resolution results.
   *
   * @param hostname Hostname to resolve.
   * @param family Address family (4 or 6).
   * @param requestTime Time of the lookup request.
   * @returns Resolved addresses or undefined if resolution failed.
   */
  protected async tryResolveFamilyViaResolverService(
    hostname: string,
    family: AddressFamily,
    requestTime: number
  ): Promise<ResolveResult['4'] | ResolveResult['6']> {
    if (!this.resolverService) {
      return;
    }
    const hostnameRecord = this.cacheService?.get(hostname);
    const familyRecord = hostnameRecord ? hostnameRecord[family] : undefined;
    let resolve = familyRecord?.resolve;
    if (!resolve) {
      resolve = this.resolverService[`resolve${family}`].bind(this.resolverService, hostname);
      if (this.throttlingStrategy) {
        resolve = this.throttlingStrategy.throttle(resolve);
        if (familyRecord) {
          familyRecord.resolve = resolve;
        }
      }
    }
    try {
      const result = await resolve();
      const addresses: AddressRecord[] = [];
      const now = Date.now();
      for (const { address, ttl } of result) {
        addresses.push({ address, expiresAt: now + 1000 * ttl });
      }
      if (addresses.length > 0) {
        familyRecord?.setActual(addresses);
        return addresses;
      }
    } catch (error) {
      if (familyRecord) {
        if (this.failoverStrategy) {
          const cacheFailure = this.failoverStrategy.cacheResolverFailure(error, hostname);
          if (cacheFailure && cacheFailure.ttlMs) {
            familyRecord.error = { error, expiresAt: Date.now() + cacheFailure.ttlMs };
          }
          return this.fallbackToExpiredAddresses(hostname, familyRecord, requestTime, error);
        }
      }
      throw error;
    } finally {
      delete familyRecord?.resolve;
    }
  }

  /**
   * Falls back to expired cache addresses when resolution fails and failover strategy allows it.
   *
   * @param hostname Hostname that failed to resolve.
   * @param familyRecord Family record containing expired addresses.
   * @param requestTime Time of the lookup request.
   * @param resolveError Error that occurred during resolution.
   * @returns Expired addresses allowed by {@link FailoverStrategy#useExpiredCache} or undefined if fallback not allowed.
   * @throws Received resolveError when no fallback strategy set or expired cache usage declined by strategy, or cache unavailable.
   */
  protected fallbackToExpiredAddresses(
    hostname: string,
    familyRecord: FamilyRecord,
    requestTime: number,
    resolveError: unknown
  ): AddressRecord[] | undefined {
    if (!this.failoverStrategy) {
      throw resolveError;
    }
    const useExpiredCache = this.failoverStrategy.useExpiredCache(resolveError, hostname);
    if (!useExpiredCache) {
      throw resolveError;
    }
    familyRecord.updateExpired(requestTime, useExpiredCache.maxExpirationMs);
    if (!familyRecord.actualExpired) {
      throw resolveError;
    }
    return familyRecord.actualExpired;
  }
}
