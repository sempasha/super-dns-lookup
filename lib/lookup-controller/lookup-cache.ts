import { SetOptional } from 'type-fest';

/**
 * Pair of IP address and its TTL.
 * This data structure used to store list of resolved addresses.
 */
export interface AddressTtlPair {
  readonly address: string;
  readonly ttl: number;
}

/**
 * Pair of resolution error and its TTL.
 * This data structure used to store resolution error, when {@link FailoverStrategy#cacheResolverFailure} tell to do so.
 */
export interface ErrorTtlPair {
  readonly error: unknown;
  readonly ttl: number;
}

/**
 * Ip family cache data structure.
 */
export interface IpFamilyCache {
  /**
   * Resolution error.
   * I may be created by {@link LookupController} right after hostname resolution request to {@link ResolverService} has been failed and {@link FailoverStrategy#cacheResolverFailure} tell to cache errors.
   */
  error?: ErrorTtlPair;

  /**
   * Resolution promise.
   * Usually created before addressing request to {@link ResolverService} and removed right after resolution request has been resolved or rejected.
   */
  promise?: Promise<AddressTtlPair[]>;

  /**
   * Resolution result.
   * Usually created by {@link LookupController} right after hostname resolution request to {@link ResolverService} has been completed.
   */
  resolved?: AddressTtlPair[];
}

/**
 * Data stored in the cache for each known hostname.
 */
export class LookupCache {
  public readonly isIp: false | 4 | 6;

  public readonly v4?: AddressTtlPair[];
  public readonly v4mapped?: AddressTtlPair[];
  public readonly v6?: AddressTtlPair[];

  public readonly v4error?: ErrorTtlPair;
  public readonly v4promise?: Promise<AddressTtlPair[]>;
  public readonly v6error?: ErrorTtlPair;
  public readonly v6promise?: Promise<AddressTtlPair[]>;

  public constructor({ isIp, v4, v4mapped, v6 }: LookupCache) {
    this.isIp = isIp;
    this.v4 = v4;
    this.v4mapped = v4mapped;
    this.v6 = v6;
  }
}
