import { ResolvedAddress } from '../../resolver-service';
import { LookupOptions } from '../lookup-controller';

/**
 * Address family, normalized.
 */
export type AddressFamily = 4 | 6;

/**
 * Pair of IP address and its expiration unix-time.
 * This data structure used to store list of resolved addresses.
 */
export interface AddressRecord {
  readonly address: string;
  readonly expiresAt: number;
}

/**
 * Pair of resolution error and its expiration unix-time.
 * This data structure used to store resolution error, when {@link FailoverStrategy#cacheResolverFailure} tells to do so.
 */
export interface ErrorRecord {
  readonly error: unknown;
  readonly expiresAt: number;
}

/**
 * IP family resolution result and temporary data.
 */
export class FamilyRecord {
  /**
   * Actual resolved addresses.
   * List of addresses should be populated after successful {@link ResolverService#resolve4}/{@link ResolverService#resolve6} call.
   * It should be actualized occasionally, {@link FamilyRecord#expiresAt} tells when exactly.
   */
  public actual?: AddressRecord[];

  /**
   * Portion of {@link FamilyRecord#expired} that is eligible for reply under {@link FailoverStrategy#useExpiredCache} due to the maxExpirationMs criterion.
   * This list keeps expired addresses suitable for reply between requests.
   */
  public actualExpired?: AddressRecord[];

  /**
   * Resolution error.
   */
  public error?: ErrorRecord;

  /**
   * Expired addresses kept in case {@link FailoverStrategy#useExpiredCache} allow expired addresses to be used.
   * List of addresses populated by moving expired {@link FamilyRecord#addresses} records.
   */
  public expired?: AddressRecord[];

  /**
   * Minimal expiration date of all actual addresses, the earliest time when any one actual address will expire.
   * It is the time, when expired records should be moved from {@link FamilyRecord#actual} to {@link FamilyRecord#expired}.
   */
  public expiresAt?: number;

  /**
   * Result of {@link IsIpService#isIPv4}/{@link IsIpService#isIPv6} check.
   */
  public isIp?: boolean;

  /**
   * Resolve function throttled by {@link ThrottlingStrategy#throttle}.
   */
  public resolve?: () => Promise<ResolvedAddress[]>;

  /**
   * Family record constructor.
   * @param actual List of actual addresses.
   */
  public constructor(record?: Pick<FamilyRecord, 'actual'>) {
    this.actual = record?.actual;
  }

  /**
   * Set new actual address list.
   * Resets {@link FamilyRecord#actualExpired} and {@link FamilyRecord#expired} lists, {@link FamilyRecord#error} and {@link FamilyRecord#expiresAt}.
   * @param actual New list of actual addresses.
   */
  public setActual(actual: AddressRecord[]) {
    this.actual = actual;
    delete this.actualExpired;
    delete this.expired;
    delete this.expiresAt;
    delete this.error;
  }

  /**
   * Updates list of actual addresses.
   * Moves all non-actual addresses to {@link FamilyRecord#expired} list.
   * Sets {@link FamilyRecord#expiresAt} to the moment of time, next of {@link FamilyRecord#actual} addresses will expire.
   * @param now Moment of time actuality is calculated for.
   */
  public updateActual(now: number = Date.now()): void {
    if (!this.actual) {
      return;
    }
    if (!this.expiresAt) {
      this.expiresAt = -Infinity;
    }
    if (this.expiresAt < now) {
      this.expiresAt = Infinity;
      const justExpired: AddressRecord[] = [];
      for (let i = 0; i < this.actual.length; i++) {
        const record = this.actual[i]!;
        if (record.expiresAt < now) {
          justExpired.push(...this.actual.splice(i, 1));
          i--;
        } else if (this.expiresAt > record.expiresAt) {
          this.expiresAt = record.expiresAt;
        }
      }
      if (justExpired.length > 0) {
        justExpired.sort(({ expiresAt: a }, { expiresAt: b }) => (a > b ? -1 : 1));
        if (this.expired) {
          this.expired.unshift(...justExpired);
        } else {
          this.expired = justExpired;
        }
      }
    }
  }

  /**
   * Move addresses between the two lists {@link FamilyRecord#expired} and {@link FamilyRecord#actualExpired} to separate completely expired addresses from those that may still be considered actual in certain circumstances.
   * @param now Moment of time actuality is calculated for.
   * @param maxExpirationMs Addresses expired less then specified amount of milliseconds threated as actual.
   */
  public updateExpired(now: number = Date.now(), maxExpirationMs = 0): void {
    this.updateActual(now);

    const maxExpiresAt = now - maxExpirationMs;

    if (this.expired) {
      let count = 0;
      while (count < this.expired.length) {
        if (this.expired[count]!.expiresAt > maxExpiresAt) {
          count++;
        } else {
          break;
        }
      }
      const expiredButActual = this.expired.splice(0, count);
      if (this.actualExpired) {
        this.actualExpired.unshift(...expiredButActual);
      } else {
        this.actualExpired = expiredButActual;
      }
    }

    if (this.actualExpired) {
      let count = this.actualExpired.length;
      while (count > 0) {
        if (this.actualExpired[count - 1]!.expiresAt <= maxExpiresAt) {
          count--;
        } else {
          break;
        }
      }
      const expired = this.actualExpired.splice(count);
      if (this.expired) {
        this.expired.push(...expired);
      } else {
        this.expired = expired;
      }
    }
  }

  /**
   * Converts family record to JSON.
   * @returns JSON representation of family record.
   */
  public toJSON(): FamilyRecordJson {
    const { actual } = this;
    return { actual };
  }
}

/**
 * JSON representation of family record.
 * Supposed to be used by {@link PersistentStorageService} to store {@link CacheService} data.
 */
export interface FamilyRecordJson extends Pick<FamilyRecord, 'actual'> {}

/**
 * Validates value to be {@link FamilyRecordJson}.
 * @param family expected family of potential {@link FamilyRecordJson}.
 * @param value Potential {@link FamilyRecordJson}.
 * @returns Verdict whether value implements {@link FamilyRecordJson} interface or not.
 */
export function isFamilyRecordJson(family: 4 | 6, value: unknown): value is FamilyRecordJson {
  const isAddressRecord = (addressRecord: unknown): addressRecord is AddressRecord => {
    if (typeof addressRecord !== 'object' || addressRecord === null) {
      return false;
    }
    if (!('address' in addressRecord) || typeof addressRecord.address !== 'string') {
      return false;
    }
    if (!('expiresAt' in addressRecord) || typeof addressRecord.expiresAt !== 'number') {
      return false;
    }
    return true;
  };
  const isAddressRecords = (addressRecords: unknown): addressRecords is AddressRecord[] => {
    if (!Array.isArray(addressRecords)) {
      return false;
    }
    for (const addressRecord of addressRecords) {
      if (!isAddressRecord(addressRecord)) {
        return false;
      }
    }
    return true;
  };
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if ('actual' in value && !isAddressRecords(value.actual)) {
    return false;
  }
  return true;
}

/**
 * Hostname resolution results and temporary data stored by {@link CacheService}.
 */
export class HostnameRecord {
  /**
   * IPv4 resolution result and temporary data.
   */
  public 4?: FamilyRecord;

  /**
   * IPv6 resolution result and temporary data.
   */
  public 6?: FamilyRecord;

  /**
   * Hostname record constructor.
   * @param record Partial hostname record data.
   */
  public constructor(record?: Partial<Record<4 | 6, FamilyRecordJson>>) {
    if (record) {
      if (record[4]) {
        this[4] = new FamilyRecord(record[4]);
      }
      if (record[6]) {
        this[6] = new FamilyRecord(record[6]);
      }
    }
  }

  /**
   * Converts hostname record to JSON.
   * @returns JSON representation of family record.
   */
  public toJSON(): HostnameRecordJson {
    const json: HostnameRecordJson = {};
    for (const family of [4, 6] as const) {
      if (this[family]) {
        json[family] = this[family].toJSON();
      }
    }
    return json;
  }
}

/**
 * JSON representation of family record.
 * Supposed to be used by {@link PersistentStorageService} to store {@link CacheService} data.
 */
export interface HostnameRecordJson extends Partial<Record<4 | 6, FamilyRecordJson>> {}

/**
 * Validates value to be {@link HostnameRecordJson}.
 * @param value Potential {@link HostnameRecordJson}.
 * @returns Verdict whether value implements {@link HostnameRecordJson} interface or not.
 */
export function isHostnameRecordJson(value: unknown): value is HostnameRecordJson {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if ('4' in value && !isFamilyRecordJson(4, value[4])) {
    return false;
  }
  if ('6' in value && !isFamilyRecordJson(6, value[6])) {
    return false;
  }
  return true;
}

/**
 * Address resolution options which must be taken into account during {@link LookupController#lookup} request handling.
 */
export interface ResolveOptions {
  /**
   * IP address families to be resolved.
   * It depends on {@link LookupOptions#family} and {@link LookupOptions#hints} (ADDRCONFIG).
   */
  family: Set<AddressFamily>;
}

/**
 * Lookup result preparation options must be taken in count during {@link LookupController#lookup} request handling.
 */
export interface ResponseOptions {
  /**
   * Lookup families suitable for result preparation.
   * It depends on {@link LookupOptions#family} and ADDRCONFIG, ALL and V4MAPPED {@link LookupOptions#hints}.
   */
  family: Set<AddressFamily>;

  /**
   * The way how to include IPv4 mapped addresses in the response:
   *
   *  - no: do not include, this variant should be used when V4MAPPED {@link LookupOptions#hints} has not been set;
   *  - when_no_6: include when no IPv6 addresses found, this variant should be used when V4MAPPED {@link LookupOptions#hints} has been set;
   *  - yes: include even when IPv6 addresses found, this variant should be used when ALL and V4MAPPED {@link LookupOptions#hints} has been set.
   */
  mapped: 'no' | 'when_no_6' | 'yes';

  /**
   * Order of IP address families in the result.
   * It depends on {@link LookupOptions#order} and {@link LookupOptions#verbatim}.
   */
  order: Exclude<LookupOptions['order'], undefined | 'verbatim'>;
}

/**
 * Convenience interface to keep all options in one place.
 */
export interface AllOptions {
  /**
   * Lookup request options specified by used.
   */
  lookup: LookupOptions;

  /**
   * {@link ResolveOptions} parsed from {@link LookupOptions}.
   */
  resolve: ResolveOptions;

  /**
   * {@link ResponseOptions} parsed from {@link LookupOptions}.
   */
  response: ResponseOptions;

  /**
   * Time when {@link LookupController#lookup} request has been initiated.
   */
  requestTime: number;
}

/**
 * Resolved hostname record.
 * In contrast with {@link HostnameRecord}, families have only addresses without expiration timestamps.
 */
export interface ResolveResult {
  /**
   * IPv4 resolution result.
   */
  4?: Pick<AddressRecord, 'address'>[];

  /**
   * IPv6 resolution result.
   */
  6?: Pick<AddressRecord, 'address'>[];
}

/**
 * Maps IPv4 into IPv6 address using well-known prefix `::ffff:0:0/96` according to [RFC 6052](https://datatracker.ietf.org/doc/html/rfc6052).
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6052#section-4.2
 * @param address IPv4 address.
 * @returns IPv6 address.
 */
export function mapIPv4toIPv6(addressRecord: Pick<AddressRecord, 'address'>): string {
  return `::ffff:${addressRecord.address}`;
}
