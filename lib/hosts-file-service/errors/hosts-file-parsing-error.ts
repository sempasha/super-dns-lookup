import { SuperDnsLookupError } from '../../error';

/**
 * {@link HostsFileService#read} implementation should throw this error when hosts file parsing error occurred.
 *
 * @group Errors
 * @group HostsFileService
 */
export class HostsFileParsingError extends SuperDnsLookupError {
  public constructor(
    public readonly path: string,
    public readonly cause: unknown
  ) {
    super(`Hosts file parsing error "${path}" is not readable.`);
  }
}
