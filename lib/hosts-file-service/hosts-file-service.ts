import { type EventEmitter } from 'node:events';
import { type HostnameAddressPair } from './hostname-address-pair';

/**
 * {@link HostsFileService} provides a simple interface for interacting with the hosts file:
 *
 * - Read hostname/address pairs from the file;
 * - Watch for changes to the file.
 *
 * @group HostsFileService
 * @example
 * import { watch } from 'node:fs';
 * import { readFile } from 'node:fs/promises';
 * import { EOL } from 'node:os';
 * import { type HostnameAddressPair, type HostsFileService } from 'super-dns-lookup';
 *
 * export class HostsFileServiceExample implements HostsFileService {
 *   protected readonly controller = new AbortController();
 *
 *   public constructor(protected readonly path: string) {}
 *
 *   public read() {
 *     const contents = await readFile(this.path, { encoding: 'utf-8' });
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
 *     watch(this.path, { abortSignal: this.controller.signal });
 *   }
 *
 *   public stopWatch() {
 *     this.controller.abort();
 *   }
 *
 *   protected lineHasHostnameAddressPair(line: string): boolean {
 *     // returns true when line as a hostname and IP address
 *   }
 * }
 */
export interface HostsFileService extends Pick<EventEmitter<{ error: [unknown] }>, 'on' | 'off'> {
  /**
   * Path of hosts file.
   * It should be `/etc/hosts` on Unix like systems or `C:\Windows\System32\drivers\etc\hosts` on Windows until explicitly specified.
   */
  readonly path: string;

  /**
   * Reads hosts file to get all hostname/address pairs from the file.
   *
   * Throws {@link HostsFileNotFound} error when hosts file not found.
   * Throws {@link HostsFileNotReadable} error when file reading is not possible (because the lack of permissions for example).
   *
   * Method is used by {@link LookupController#bootstrap} to read hostname and IP address pairs from hosts file, later {@link LookupController} may read hosts when file changes.
   * It also may be used by {@link LookupController#lookup} to read hosts file for first time when user forget to prepare controller for work with {@link LookupController#bootstrap}.
   *
   * @group HostsFileService
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
   * @throws {@link HostsFileNotFound}.
   * @throws {@link HostsFileNotReadable}.
   */
  read(): Promise<HostnameAddressPair[]>;

  /**
   * Starts watching for hosts file changes.
   * Calls `updateHandler` function on every change of hosts file after watch has been started.
   * Calls `updateHandler` function when file has been renamed (moved or deleted).
   * When new hosts file has appeared instead of renamed one, calls `updateHandler` function and continue watch.
   * When hosts file not exists, calls `updateHandler` when hosts file appears.
   * Emits 'error' event when error occurred in `updateHandler` (supports sync and async `updateHandlers`).
   * Watcher process does not block process from existing.
   *
   * Method is used by {@link LookupController#bootstrap} to start watching for hosts file changes.
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
   * @throws {@link HostsFileNotFound}.
   */
  watch(updateHandler: () => Promise<void> | void): void;

  /**
   * Interrupts watching for hosts file changes, `updateHandler` callback will not called anymore despite hosts file changes.
   *
   * Method is used by {@link LookupController#teardown} to stop watching for hosts file changes.
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
  stopWatching(): void;
}
