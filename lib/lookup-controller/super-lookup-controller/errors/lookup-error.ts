import {
  type BADFAMILY,
  type BADFLAGS,
  type BADHINTS,
  type BADNAME,
  type BADQUERY,
  type BADRESP,
  type BADSTR,
  type CANCELLED,
  type CONNREFUSED,
  type FORMERR,
  type NODATA,
  type NOMEM,
  type NONAME,
  type NOTFOUND,
  type NOTINITIALIZED,
  type NOTIMP,
  type REFUSED,
  type SERVFAIL,
  type TIMEOUT
} from 'node:dns';
import { inspect } from 'node:util';
import { type LiteralUnion } from 'type-fest';
import { type LookupOptions } from '../../lookup-controller';
import { SuperDnsLookupError } from '../../../error';
import { name } from '../../../../package.json';

/**
 * {@link LookupError} code which meaning is "multiple reasons of failure".
 */
export const MULTIREASON = 'EMULTIREASON';

/**
 * {@link LookupError} code which meaning is "no clear reason of failure".
 */
export const UNCLEAR = 'EUNCLEAR';

/**
 * All possible {@link LookupError#code} values.
 * The lits is based on [dns module errors codes](https://nodejs.org/docs/latest/api/dns.html#error-codes) with additional codes:
 *  - EMULTIREASON: represents multiple errors at once;
 *  - ENOADDRCONFIG: inability to handle request because there is no network interfaces available in system for specified {@link LookupOptions#family} or no interfaces available at all;
 *  - EUNCLEAR: error cause is unclear, i.e. error caused by unexpected error.
 */
export type LookupErrorCode = LiteralUnion<
  | typeof BADFAMILY
  | typeof BADFLAGS
  | typeof BADHINTS
  | typeof BADNAME
  | typeof BADQUERY
  | typeof BADRESP
  | typeof BADSTR
  | typeof CANCELLED
  | typeof CONNREFUSED
  | typeof FORMERR
  | typeof NODATA
  | typeof NOMEM
  | typeof NONAME
  | typeof NOTFOUND
  | typeof NOTINITIALIZED
  | typeof NOTIMP
  | typeof REFUSED
  | typeof SERVFAIL
  | typeof TIMEOUT
  | typeof MULTIREASON
  | typeof UNCLEAR,
  string
>;

/**
 * Lookup error meant to be the only error class thrown by {@link LookupController#lookup} method.
 * Any lower level errors, like {@link ResolverService} error should be wrapped into {@link LookupError}.
 */
export class LookupError extends SuperDnsLookupError {
  /**
   * Current error reason, same as the very basic {@link Error#cause}.
   */
  public readonly cause: unknown | unknown[];

  /**
   * Error code string.
   */
  public readonly code: LookupErrorCode;

  /**
   * The hostname whose IP address {@link LookupController#lookup} request has been failed.
   */
  public readonly hostname: string;

  /**
   * Error message, same as the very basic {@link Error#message}.
   */
  public readonly message: string;

  /**
   * Lookup options or failed {@link LookupController#lookup} request.
   */
  public readonly options: LookupOptions;

  public constructor(hostname: string, options: LookupOptions, code: LookupErrorCode);
  public constructor(hostname: string, options: LookupOptions, cause: unknown | unknown[]);
  public constructor(
    hostname: string,
    options: LookupOptions,
    codeOrCauseOrCauses?: LookupErrorCode | unknown | unknown[]
  ) {
    super();
    let cause: unknown | unknown[];
    let code: LookupErrorCode;
    let reasonString: string;
    if (Array.isArray(codeOrCauseOrCauses)) {
      if (codeOrCauseOrCauses.length === 0) {
        codeOrCauseOrCauses = undefined;
      } else if (codeOrCauseOrCauses.length === 1) {
        codeOrCauseOrCauses = codeOrCauseOrCauses[0];
      }
    }
    if (typeof codeOrCauseOrCauses === 'string') {
      reasonString = `with code ${codeOrCauseOrCauses}.`;
      code = codeOrCauseOrCauses;
    } else if (Array.isArray(codeOrCauseOrCauses)) {
      reasonString = 'because of multiple of errors.';
      cause = codeOrCauseOrCauses;
      const codes = Array.from(new Set(codeOrCauseOrCauses.map(getErrorCode)));
      code = codes.length === 1 ? codes[0]! : MULTIREASON;
    } else if (codeOrCauseOrCauses instanceof Error) {
      const { message, name } = codeOrCauseOrCauses;
      reasonString = `because of ${name}: ${message.slice(-1) === '.' ? message : `${message}.`}`;
      cause = codeOrCauseOrCauses;
      code = getErrorCode(cause);
    } else {
      reasonString = 'with unclear reason.';
      cause = UNCLEAR;
      code = getErrorCode(cause);
    }

    const optionsString = inspect(options, { breakLength: Infinity, colors: false, depth: Infinity });
    const message = `${name} LookupController#lookup(hostname=${hostname}, options=${optionsString}) failed ${reasonString}`;

    this.cause = cause;
    this.code = code;
    this.hostname = hostname;
    this.message = message;
    this.options = options;
  }
}

/**
 * {@link LookupError} code which meaning is "system has no network interfaces or presenter network interfaces does not match with requested families".
 */
export class AddrConfigConflict extends SuperDnsLookupError {
  public code = 'ENOADDRCONFIG';
  public constructor(
    public options: LookupOptions,
    public availableFamilies: Set<4 | 6>
  ) {
    super('System has no network interfaces or existing network interfaces does not match with requested families.');
  }
}

function getErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : UNCLEAR;
}
