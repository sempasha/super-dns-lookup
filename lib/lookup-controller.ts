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

/**
 * DNS lookup options. *Type based on NodeJS documentation.*
 *
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
 * @see https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback
 */
export interface LookupOptions<All extends boolean | undefined = undefined> extends DNSLookupOptions {
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
   * One or more supported getaddrinfo flags.
   * Multiple flags may be passed by bitwise ORing their values.
   *
   * @see https://nodejs.org/docs/latest/api/dns.html#supported-getaddrinfo-flags
   * @default 0
   */
  hints?: 0 | typeof ADDRCONFIG | typeof ALL | typeof V4MAPPED | undefined;

  /**
   * When `true`, the callback returns all resolved addresses in an array.
   * Otherwise, returns a single address.
   *
   * @default false
   */
  all?: All | undefined;

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
 * @example
 * let singleAddress: Awaited<LookupResult<false>>;
 * let listOfAddresses: Awaited<LookupResult<true>>;
 */
export type LookupResult<All extends boolean | undefined = undefined> = All extends true ? string[] : string;

/**
 * Lookup function result handler.
 *
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
export type LookupCallback<All extends boolean | undefined = undefined> = (
  error: unknown | undefined,
  result: LookupResult<All>
) => void;

/**
 * Lookup controller itself.
 *
 * @example
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
 * @example
 * import { LookupController } from 'super-dns-lookup';
 *
 * const controller = new Controller();
 * void controller.bootstrap();
 * process.once('SIGTERM', () => controller.teardown());
 * export const lookup = Controller.lookup.bind();
 */
export interface LookupController {
  bootstrap(): Promise<void>;
  install(agent: HttpAgent | HttpsAgent): void;
  lookup<All extends boolean | undefined = undefined>(hostname: string): Promise<LookupResult<All>>;
  lookup<All extends boolean | undefined = undefined>(
    hostname: string,
    options: LookupOptions<All>
  ): Promise<LookupResult<All>>;
  lookup<All extends boolean | undefined = undefined>(hostname: string, callback: LookupCallback<All>): void;
  lookup<All extends boolean | undefined = undefined>(
    hostname: string,
    options: LookupOptions<All>,
    callback: LookupCallback<All>
  ): void;
  teardown(): Promise<void>;
}

export interface LookupControllerOptions {
  /**
   * CacheService is a simple synchronous in-memory storage.
   * LookupController uses it to store hostname resolution results and ip address check results.
   * By default LRUCacheService will be used.
   *
   * @default LRUCacheService
   */
  cacheService?: CacheService<ResolvedAddress[]>;

  /**
   * Strategy of choosing one element of many.
   * It helps LookupController to choose one address of a list.
   * By default RoundRobinChoiceStrategy will be used.
   *
   * @default RoundRobinChoiceStrategy
   */
  choiceStrategy?: ChoiceStrategy;

  /**
   * HostsFileService provides a simple interface for interacting with the hosts file:
   * - Read hostname/address pairs from the file;
   * - Watch for changes to the file.
   * By default will be used UniversalHostsFileService which supports Linux, MacOS and Windows.
   * You may specify
   *
   * @default UniversalHostsFileService
   */
  hostsFileService?: HostsFileService;

  /**
   * @default NodeIsIpService
   */
  isIpService?: IsIpService;

  /**
   * @default true
   */
  resolveLock?: boolean;

  /**
   * @default 1000
   */
  resolveLockTimeoutMs?: number;

  /**
   * @default NodeResolverService
   */
  resolverService?: ResolverService;

  /**
   * @default undefined
   */
  persistentStorageService?: PersistentStorageService;
}

export class LookupController {
  protected cacheService: CacheService;
  protected choiceStrategy: ChoiceStrategy;
  protected hostsFileService: HostsFileService;
  protected isIpService: IsIpService;
  protected resolverService: ResolverService;
  protected persistentStorageService?: PersistentStorageService;
  protected resolveLock: boolean;
  protected resolveLockTimeoutMs: number;

  public constructor({
    cacheService = new LRUCacheService(),
    choiceStrategy = new RoundRobinChoiceStrategy(),
    hostsFileService = new UniversalHostsFileService(),
    isIpService = new NodeIsIpService(),
    resolverService = new NodeResolverService(),
    persistentStorageService,
    resolveLock = true,
    resolveLockTimeoutMs = 1000
  }: LookupControllerOptions = {}) {
    this.cacheService = cacheService;
    this.choiceStrategy = choiceStrategy;
    this.hostsFileService = hostsFileService;
    this.isIpService = isIpService;
    this.resolverService = resolverService;
    this.persistentStorageService = persistentStorageService;
    this.resolveLock = resolveLock;
    this.resolveLockTimeoutMs = resolveLockTimeoutMs;
  }

  public async bootstrap() {
    throw new Error('Method not implemented.');
  }

  public async install(agent: HttpAgent | HttpsAgent) {
    throw new Error('Method not implemented.');
  }

  public lookup<All extends boolean | undefined = undefined>(hostname: string): Promise<LookupResult<All>>;
  public lookup<All extends boolean | undefined = undefined>(
    hostname: string,
    options: LookupOptions<All>
  ): Promise<LookupResult<All>>;
  public lookup<All extends boolean | undefined = undefined>(hostname: string, callback: LookupCallback<All>): void;
  public lookup<All extends boolean | undefined = undefined>(
    hostname: string,
    options: LookupOptions<All>,
    callback: LookupCallback<All>
  ): void;
  public lookup<All extends boolean | undefined = undefined>(
    hostname: string,
    optionsOrCallback?: LookupOptions<All> | LookupCallback<All> | undefined,
    maybeCallback?: LookupCallback<All> | undefined
  ): Promise<LookupResult<All>> | void {
    throw new Error('Method not implemented.');
  }

  public async teardown() {
    throw new Error('Method not implemented.');
  }
}
