import { SuperDnsLookupError } from '../../error';

/**
 * {@link HostsFileService#read} implementation should throw this error when hosts file is not readable.
 *
 * @group Errors
 * @group HostsFileService
 */
export class HostsFileNotReadable extends SuperDnsLookupError {
  public constructor(public readonly path: string) {
    super(`Hosts file "${path}" is not readable.`);
  }
}
