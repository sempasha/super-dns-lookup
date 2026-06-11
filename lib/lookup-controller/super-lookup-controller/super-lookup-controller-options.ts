import { type LiteralUnion } from 'type-fest';
import { type CacheService } from '../../cache-service';
import { type ChoiceStrategy } from '../../choice-strategy';
import { type FailoverStrategy } from '../../failover-strategy';
import { type HostsFileService } from '../../hosts-file-service';
import { type IsIpService } from '../../is-ip-service';
import { type PersistentStorageService } from '../../persistent-storage-service';
import { type ResolverService } from '../../resolver-service';
import { type ThrottlingStrategy } from '../../throttling-strategy';
import { type LookupOptions } from '../lookup-controller';

/**
 * Name of libc library will be used for compatibility with getaddrinfo behaviour.
 */
export type SuperLookupControllerLibcCompatibilityName = LiteralUnion<'glibc' | 'musl', string>;

/**
 * Options of {@link SuperLookupController}
 *
 * @group LookupController
 */
export interface SuperLookupControllerOptions {
  /**
   * Allows usage of custom {@link CacheService} to store hostname resolution results and IP address check results.
   * By default {@link LRUCacheService} will be used.
   * When `null`, no {@link CacheService} will be used, so quite every {@link LookupController#lookup} request ends up with network request.
   *
   * @default {@link LRUCacheService}
   */
  cacheService?: CacheService | null;

  /**
   * Allows usage of custom {@link ChoiceStrategy} to choose the only one IP address of a list.
   * By default {@link RoundRobinChoiceStrategy} will be used.
   * When `null`, no {@link ChoiceStrategy} will be used, so every {@link LookupController#lookup} request of single address ends up with first found ip address.
   *
   * @default {@link RoundRobinChoiceStrategy}
   */
  choiceStrategy?: ChoiceStrategy | null;

  /**
   * Allows usage of custom {@link FailoverStrategy} to choose:
   *  - whether to use expired cache to reply to the lookup request or not;
   *  - whether to cache resolution errors or not to reduce pressure on {@link ResolverService}.
   * By default {@link UniversalFailoverStrategy} will be used.
   * When `null`, no {@link FailoverStrategy} will be used, so every occurred lookup error will be thrown.
   *
   * @default {@link UniversalFailoverStrategy}
   */
  failoverStrategy?: FailoverStrategy | null;

  /**
   * Allows usage of custom {@link HostsFileService} to interact with hosts file:
   * - Read hostname/address pairs from the file;
   * - Watch for changes in the file.
   * By default {@link UniversalHostsFileService} will be used, it supports Linux, MacOS and Windows.
   * When `null`, no {@link HostsFileService} will be used to handle {@link LookupController#lookup} request, so hosts file contents will be ignored.
   *
   * @default {@link UniversalHostsFileService}
   */
  hostsFileService?: HostsFileService | null;

  /**
   * Allows usage of custom {@link IsIpService} to know whether given string an IP address or not.
   * It also identifies IP address family: IPv4 or IPv6.
   * By default {@link NodeIsIpService} used.
   * When `null`, no {@link IsIpService} will be used to handle {@link LookupController#lookup} request.
   *
   * @default {@link NodeIsIpService}
   */
  isIpService?: IsIpService | null;

  /**
   * Controls whether {@link LookupController#bootstrap} will be called automatically on first {@link LookupController#lookup} request.
   * When disabled, user should call {@link LookupController#bootstrap} themselves.
   * When enabled, {@link LookupController#bootstrap} will be called on first {@link LookupController#lookup} and block request handling until bootstrapped.
   *
   * @default false
   */
  lazyBootstrap?: boolean;

  /**
   * Control whether {@link LookupController#teardown} will be called automatically on process shutdown.
   * When disabled, user should call {@link LookupController#teardown} themselves.
   * When enabled, {@link LookupController#teardown} will be called on specified process signal event.
   * Recommended choice of signals: SIGINT (Ctrl+C), SIGTERM (common kill).
   *
   * @default false
   */
  lazyTeardown?:
    | false
    | ('SIGABRT' | 'SIGBREAK' | 'SIGHUP' | 'SIGINT' | 'SIGQUIT' | 'SIGSTOP' | 'SIGTERM' | 'SIGUSR1' | 'SIGUSR2')[];

  /**
   * Name of libc library will be used for compatibility with getaddrinfo behaviour.
   * For example different library implementations interpret ENODATA error in different ways:
   *
   * - glibs tends to treat this error as EAI_AGAIN;
   * - while musl tents to treat this error as ENOTFOUND.
   *
   * @default undefined
   */
  libcCompatibilityName?: SuperLookupControllerLibcCompatibilityName | null;

  /**
   * Allows usage of custom {@link PersistentStorageService} to populate initial cache during {@link LookupController#bootstrap} and write out cache data during {@link LookupController#teardown} for future use.
   * By default no persistent storage service configured, so user must provide their own implementation to get this feature working.
   * When `null`, no {@link PersistentStorageService} will be used to populate cache on {@link LookupController#bootstrap} and dump it during {@link LookupController#teardown}.
   *
   * @default null
   */
  persistentStorageService?: PersistentStorageService | null;

  /**
   * Allows usage of custom {@link ResolverService} to resolve given hostname to IP address of different families IPv4 or IPv6.
   * By default {@link NodeResolverService} will be used.
   * When the option is `null`, no {@link ResolverService} will be used to handle {@link LookupController#lookup} request.
   * In this case, the only way to resolve the hostname will be through the hosts file.
   *
   * @default {@link NodeResolverService}
   */
  resolverService?: ResolverService | null;

  /**
   * Allows usage of custom {@link ThrottlingStrategy} to reduce load on:
   * - {@link ResolverService} when calling {@link ResolverService#resolve4} and {@link ResolverService#resolve6};
   * - NodeJS process to check available ip address families in case `dns.ADDRCONFIG` [hint](https://nodejs.org/api/dns.html#supported-getaddrinfo-flags) used.
   * By default {@link UniversalThrottlingStrategy} will be used.
   * When `null`, no {@link ThrottlingStrategy} will be used at all.
   *
   * @default {@link UniversalThrottlingStrategy}
   */
  throttlingStrategy?: ThrottlingStrategy | null;

  /**
   * Verbatim order of ip address families in the result when nor {@link LookupOptions#order}, nor {@link LookupOptions#verbatim} specified.
   * This order will be used in case when {@link LookupOptions#order} has verbatim value, or when neither {@link LookupOptions#order} nor {@link LookupOptions#verbatim} specified and [dns.getDefaultResultOrder](https://nodejs.org/docs/latest/api/dns.html#dnsgetdefaultresultorder) tells to use verbatim order.
   *
   * @default 'ipv4first'
   */
  verbatimOrder?: Exclude<LookupOptions['order'], undefined | 'verbatim'>;
}
