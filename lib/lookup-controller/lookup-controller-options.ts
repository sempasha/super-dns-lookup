import { CacheService } from '../cache-service';
import { ChoiceStrategy } from '../choice-strategy';
import { FailoverStrategy } from '../failover-strategy';
import { HostsFileService } from '../hosts-file-service';
import { IsIpService } from '../is-ip-service';
import { PersistentStorageService } from '../persistent-storage-service';
import { ResolvedAddress, ResolverService } from '../resolver-service';
import { ThrottlingStrategy } from '../throttling-strategy';

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
