import { platform } from 'node:os';
import { HostnameAddressPair, HostsFileService } from './hosts-file-service';
import { UnsupportedPlatform } from './errors/unsupported-platform';

/**
 * Options of {@link UniversalHostsFileService}.
 *
 * @group HostsFileService
 * @example
 * const options: UniversalHostsFileServiceOptions = { path: '/root/etc/hosts' };
 */
export interface UniversalHostsFileServiceOptions {
  /**
   * Path where hosts is stored.
   * Default value depends on platform:
   *
   *  - `/etc/hosts` for Linux and MacOS;
   *  - `C:\Windows\System32\drivers\etc\hosts` for Windows.
   *
   * Options will be used during watching for hosts file changes by {@link HostsFileService#watch} and reading of hosts file by {@link HostsFileService#read}.
   */
  path?: string;
}

/**
 * Universal HostsFIleService implementation.
 * Suitable for Linux, MacOS and Windows.
 *
 * @group HostsFileService
 * @example
 * import { UniversalHostsFileService } from 'super-dns-lookup';
 *
 * const hostsFileService = new UniversalHostsFileService();
 * const lookupController = new LookupController({ hostsFileService });
 */
export class UniversalHostsFileService implements HostsFileService {
  /**
   * Path of hosts file.
   */
  protected path: string;

  /**
   * Creates universal hosts file service with specified options.
   *
   * @example
   * import { UniversalHostsFileService } from 'super-dns-lookup';
   *
   * const defaultHostsFileService = new UniversalHostsFileService();
   * const rootHostsFileService = new UniversalHostsFileService({ path: '/root/etc/hosts' });
   * @param options Hosts file options.
   */
  public constructor({ path }: UniversalHostsFileServiceOptions = {}) {
    if (!path) {
      const platformName = platform();
      switch (platformName) {
        case 'darwin':
        case 'linux':
          path = '/etc/hosts';
          break;
        case 'win32':
          path = 'C:\Windows\System32\drivers\etc\hosts';
          break;
        default:
          throw new UnsupportedPlatform(platform());
      }
    }
    this.path = path;
  }

  /**
   * Reads hosts file to get all hostname/address pairs from the file.
   * Opens hosts file specified in constructor option {@link UniversalHostsFileServiceOptions#path} in the first order.
   * Opens `/etc/hosts` on Unix like systems when constructor option {@link UniversalHostsFileServiceOptions#path} omitted.
   * Opens `C:\Windows\System32\drivers\etc\hosts` on Windows when constructor option {@link UniversalHostsFileServiceOptions#path} omitted.
   * Throws {@link HostsFileNotFound} error when hosts file not found.
   * Reads hosts file contents and extract all hostname/address pairs from it.
   * Throws {@link HostsFileNotReadable} error when file reading is not possible (because the lack of permissions for example).
   * Throws {@link HostsFileParsingError} error when parsing error occurred (unknown characters and so on).
   *
   * Method is used by {@link LookupController#bootstrap} to read hostname and ip address pairs from hosts file, later {@link LookupController} may read hosts when file changes.
   * It also may be used by {@link LookupController#lookup} to read hosts file for first time when user forget to prepare controller for work with {@link LookupController#bootstrap}.
   *
   * @example
   * import { equal } from 'node:assert';
   * import { UniversalHostsFileServiceExample } from 'super-dns-lookup';
   *
   * const hostsFileService new UniversalHostsFileService();
   * const pairs = await hostsFileService.read();
   * equal(pairs, [
   *   ['example.com', '23.192.228.80'],
   *   ['example.com', '2600:1406:3a00:21::173e:2e65'],
   * ]);
   * @returns Promise of hostname/address pairs mentioned at hosts file.
   * @throws {@link HostsFileNotFound}.
   * @throws {@link HostsFileNotReadable}.
   * @throws {@link HostsFileParsingError}.
   */
  public read(): Promise<HostnameAddressPair[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Starts watching for hosts file changes.
   * Calls `updateHandler` function on every change of hosts file after watch has been requested.
   *
   * Method is used by {@link LookupController#bootstrap} to start watching for hosts file changes.
   *
   * @example
   * import { UniversalHostsFileServiceExample } from 'super-dns-lookup';
   *
   * const hostsFileService new UniversalHostsFileService();
   * let pairs = await hostsFileService.read();
   * // start watching
   * hostsFileService.watch(async () => {
   *   // update hostname/address pairs on each hosts file change
   *   pairs = await hostsFileService.read();
   * });
   * @param updateHandler Hosts file change handler.
   * @returns Nothing.
   * @throws {@link HostsFileNotFound}.
   */
  public watch(updateHandler: () => void): void {
    throw new Error('Method not implemented.');
  }

  /**
   * Interrupts watching for hosts file changes, won't call `updateHandler` anymore despite hosts file changes.
   *
   * Method is used by {@link LookupController#teardown} to stop watching for hosts file changes.
   *
   * @example
   * import { UniversalHostsFileServiceExample } from 'super-dns-lookup';
   *
   * const hostsFileService new HostsFileService();
   * let pairs = await hostsFileService.read();
   * hostsFileService.watch(async () => {
   *   pairs = await hostsFileService.read();
   * });
   * // watch for updates during next hour only
   * setTimeout(() => hostsFileService.stopWatching(), 3600_1000)
   * @returns Nothing.
   */
  public stopWatching(): void {
    throw new Error('Method not implemented.');
  }
}
