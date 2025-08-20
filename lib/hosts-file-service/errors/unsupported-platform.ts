import { SuperDnsLookupError } from '../../error';
import { getDocsUrl } from '../../util';

/**
 * This error should be thrown when hosts file service can't choose default path of hosts file.
 * Used by {@link UniversalHostsFileService}.
 *
 * @group Errors
 * @group HostsFileService
 * @example
 * import { platform } from 'node:os';
 * import { UnsupportedPlatform } from 'super-dns-lookup';
 *
 * if (platform() === 'windows') {
 *   throw new UnsupportedPlatform('windows');
 * }
 */
export class UnsupportedPlatform extends SuperDnsLookupError {
  /**
   * @param platform Name of unsupported platform.
   */
  public constructor(public readonly platform: string) {
    super(
      `Unsupported platform '${platform}'. ` +
        'This leads to inability to determine expected hosts file location. ' +
        'To overcome this error, please, specify hosts file location using `path` option of UniversalHostsFileService constructor.' +
        `See option documentation ${getDocsUrl('#-option-path')}`
    );
  }
}
