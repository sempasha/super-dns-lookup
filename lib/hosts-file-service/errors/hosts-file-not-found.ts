import { SuperDnsLookupError } from '../../error';

/**
 * {@link HostsFileService#read} or {@link HostsFileService#watch} implementations should throw this error when hosts file has not been found.
 *
 * @group Errors
 * @group HostsFileService
 */
export class HostsFileNotFound extends SuperDnsLookupError {
  public constructor(public readonly path: string) {
    super(`Hosts file has not been found at "${path}".`);
  }
}
