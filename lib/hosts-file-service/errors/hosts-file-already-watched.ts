import { SuperDnsLookupError } from '../../error';

/**
 * {@link HostsFileService#read} or {@link HostsFileService#watch} implementations should throw this error when hosts file has not been found.
 *
 * @group Errors
 * @group HostsFileService
 */
export class HostsFileAlreadyWatched extends SuperDnsLookupError {
  public constructor(public readonly path: string) {
    super(`Hosts file '${path}' has already been under watch.`);
  }
}
