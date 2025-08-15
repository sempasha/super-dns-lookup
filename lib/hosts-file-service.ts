import { platform } from 'node:os';
import { homepage } from '../package.json';
import { SuperDnsLookupError } from './error';

/**
 * A pair consisting of a hostname and its associated IP address extracted from the hosts file.
 *
 * @example
 * import { HostnameAddressPair } from 'super-dns-lookup';
 *
 * const pairs: HostnameAddressPair[] = [
 *   ['example.com', '23.192.228.80'],
 *   ['example.com', '2600:1406:3a00:21::173e:2e65'],
 * ];
 */
export type HostnameAddressPair = [string, string];

/**
 * HostsFileService provides a simple interface for interacting with the hosts file:
 *
 * - Read hostname/address pairs from the file;
 * - Watch for changes to the file.
 *
 * @example
 * import { watch } from 'node:fs';
 * import { readFile } from 'node:fs/promises';
 * import { EOL } from 'node:os';
 * import { HostnameAddressPair, HostsFileService, LookupController } from 'super-dns-lookup';
 *
 * export class HostsFileServiceExample implements HostsFileService {
 *   protected abortWatch = new AbortController();
 *
 *   public constructor(protected path: string) {}
 *
 *   public read() {
 *     const contents = await readFile(this.path, { encoding: 'utf8' });
 *     const pairs: HostnameAddressPair[] = [];
 *     for (const line of contents.split(EOL)) {
 *       if (this.lineHasHostnameAddressPair(line)) {
 *         const [hostname, address] = line.replace(/^\s+/, '').replace(/\s+$/, '').split(/\s+/);
 *         pairs.push([hostname, address]);
 *       }
 *     }
 *     return pairs;
 *   }
 *
 *   public watch(updateHandler: () => void): void {
 *
 *     watch(this.path, { abortSignal });
 *   }
 *
 *   protected lineHasHostnameAddressPair(line: string): boolean {
 *     // returns true when line as a hostname and IP address
 *   }
 * }
 */
export interface HostsFileService {
  /**
   * Should read hosts file to get all hostname/address pairs from the file.
   * First should open hosts file in the first order.
   * Should get /etc/hosts on Unix like system or C:\Windows\System32\drivers\etc\hosts on Windows.
   * Should throw HostsFileNotFound error when hosts file not found.
   * Should read hosts file contents and extract all hostname/address pairs from it.
   * Should throw HostsFileNotReadable error when file reading is not possible (because the lack of permissions for example).
   * Should throw HostsFileParsingError error when parsing error occurred (unknown characters and so on).
   *
   * @example
   * import { equal } from 'node:assert';
   * import { HostsFileServiceExample } from './hosts-file-service-example';
   *
   * const hostsFileService new HostsFileServiceExample();
   * const pairs = await hostsFileService.read();
   * equal(pairs, [
   *   ['example.com', '23.192.228.80'],
   *   ['example.com', '2600:1406:3a00:21::173e:2e65'],
   * ]);
   * @returns Promise of list of hostname/address pairs.
   */
  read(): Promise<HostnameAddressPair[]>;

  /**
   * Should start watching for hosts file changes.
   * Should call updateHandler function on every change of hosts file after method has been called.
   *
   * @example
   * import { HostsFileServiceExample } from './hosts-file-service-example';
   *
   * const hostsFileService new HostsFileServiceExample();
   * let pairs = await hostsFileService.read();
   * // start watching
   * hostsFileService.watch(async () => {
   *   // update hostname/address pairs on each hosts file change
   *   pairs = await hostsFileService.read();
   * });
   * @param updateHandler Method which should been called on each hosts file change.
   * @returns Nothing.
   */
  watch?(updateHandler: () => void): void;

  /**
   * Should stop watching for hosts file changes.
   * Should not call updateHandler which has previously been set during HostsFileService#watch call.
   *
   * @example
   * import { HostsFileServiceExample } from './hosts-file-service-example';
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
  stopWatching?(): void;
}

/**
 * This error should be thrown when hosts file service can't choose default path of hosts file.
 */
export class UnsupportedPlatform extends SuperDnsLookupError {
  public constructor(platform: string) {
    super(
      `Unsupported platform '${platform}'. ` +
        'This leads to inability to determine expected hosts file location. ' +
        'To overcome this error, please, specify hosts file location using **path** option of HostsFileService construction.' +
        `See option documentation ${homepage}#-option-path`
    );
  }
}

/**
 * Options of HostsFileService implementation.
 *
 * @example
 * const options: UniversalHostsFileServiceOptions = { path: '/root/etc/hosts' };
 */
export type UniversalHostsFileServiceOptions = {
  path?: string;
};

/**
 * Universal HostsFIleService implementation.
 * Suitable for Linux, MacOS and Windows.
 *
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
   * Should create universal hosts file service with specified options
   *
   * @example
   * import { UniversalHostsFileService } from 'super-dns-lookup';
   *
   * const defaultHostsFileService = new UniversalHostsFileService();
   * const rootHostsFileService = new UniversalHostsFileService({ path: '/root/etc/hosts' });
   * @param options Hosts file options
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
   * Reads hosts file.
   * Should read file specified as option.path during constructor call.
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
   */
  public read(): Promise<HostnameAddressPair[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Should start hosts file watching process.
   * Should call updateHandler on each hosts file change.
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
   * @return Nothing.
   */
  public watch(updateHandler: () => void): void {
    throw new Error('Method not implemented.');
  }

  /**
   * Should stop hosts file watching process.
   * Should not call previously set updateHandler when hosts file has been changed.
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
   * @return Nothing.
   */
  public stopWatching(): void {
    throw new Error('Method not implemented.');
  }
}
