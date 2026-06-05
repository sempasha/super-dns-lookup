import { type FSWatcher, access, constants, createReadStream, stat, watch } from 'node:fs';
import EventEmitter from 'node:events';
import { isIP } from 'node:net';
import os from 'node:os';
import { createInterface } from 'node:readline/promises';
import { setInterval } from 'node:timers';
import { HostsFileAlreadyWatched, HostsFileNotFound, HostsFileNotReadable, UnsupportedPlatform } from './errors';
import { type HostnameAddressPair } from './hostname-address-pair';
import { type HostsFileService } from './hosts-file-service';

/**
 * Options of {@link UniversalHostsFileService}.
 *
 * @group HostsFileService
 * @example
 * const options: UniversalHostsFileServiceOptions = { path: '/root/etc/hosts' };
 */
export interface UniversalHostsFileServiceOptions {
  /**
   * When hosts file has been renamed service will start new hosts file explorer.
   * It will probe hew hosts file has been appeared at given place.
   * This it probes interval in milliseconds.
   *
   * @default 1000
   */
  probeIntervalMs?: number;

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
 * import { SuperLookupController, UniversalHostsFileService } from 'super-dns-lookup';
 *
 * const hostsFileService = new UniversalHostsFileService();
 * const lookupController = new SuperLookupController({ hostsFileService });
 */
export class UniversalHostsFileService extends EventEmitter<{ error: [unknown] }> implements HostsFileService {
  /**
   * Path of hosts file.
   * @default `/etc/hosts` on Unix like systems or `C:\Windows\System32\drivers\etc\hosts` on Windows.
   */
  public readonly path: string;

  /**
   * Hosts file probes interval in milliseconds.
   * When hosts file moved away (deleted or renamed), hosts file service will run probes with given interval to find new hosts file.
   */
  protected readonly probeIntervalMs: number;

  /**
   * Hosts file probes interval identifier.
   * When hosts file moved away (deleted or renamed), hosts file service will run probes to find new hosts file.
   */
  protected probeInterval: NodeJS.Timeout | undefined;

  /**
   * Handler which should be called on every hosts file change.
   * It will be set on {@link watch} call.
   */
  protected updateHandler: (() => Promise<void> | void) | undefined;

  /**
   * Hosts file watcher
   */
  protected watcher: FSWatcher | undefined;

  /**
   * Creates universal hosts file service with specified file path.
   * Assumes that hosts file is located at /etc/hosts for FreeBSD, Linux, MacOS and OpenDSB.
   * Assumes that hosts file is located at C:\Windows\System32\drivers\etc\hosts for Windows.
   *
   * @example
   * import { UniversalHostsFileService } from 'super-dns-lookup';
   *
   * const defaultHostsFileService = new UniversalHostsFileService();
   * const rootHostsFileService = new UniversalHostsFileService({ path: '/root/etc/hosts' });
   * @param options Hosts file options.
   */
  public constructor({ probeIntervalMs = 1000, path }: UniversalHostsFileServiceOptions = {}) {
    super();
    this.probeIntervalMs = probeIntervalMs;
    if (path) {
      this.path = path;
    } else {
      const platformName = os.platform();
      switch (platformName) {
        case 'darwin':
        case 'freebsd':
        case 'linux':
        case 'openbsd':
          this.path = '/etc/hosts';
          break;
        case 'win32':
          this.path = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
          break;
        default:
          throw new UnsupportedPlatform(platformName);
      }
    }
  }

  /**
   * Reads hosts file and returns promise of hostname/address pair from file.
   * Throws {@link HostsFileNotFound} error when hosts file not found.
   * Throws {@link HostsFileNotReadable} error when file reading is not possible (because the lack of permissions for example).
   *
   * Method is used by {@link LookupController#bootstrap} to read hostname and IP address pairs from hosts file, later {@link LookupController} may read hosts when file changes.
   * It also may be used by {@link LookupController#lookup} to read hosts file for first time when user forget to prepare controller for work with {@link LookupController#bootstrap}.
   *
   * @example
   * import { equal } from 'node:assert';
   * import { UniversalHostsFileService } from 'super-dns-lookup';
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
   */
  public async read(): Promise<HostnameAddressPair[]> {
    return new Promise((resolve, reject) => {
      const pairs: HostnameAddressPair[] = [];
      const regexp = /^\s*(.+)\s+(.+)\s*$/;
      const input = createReadStream(this.path, { encoding: 'utf-8' });
      const readline = createInterface({ input });
      readline.on('close', () => resolve(pairs));
      readline.on('error', (error: unknown) => {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
        if (code === 'ENOENT') {
          reject(new HostsFileNotFound(this.path));
        } else if (code === 'EACCES') {
          reject(new HostsFileNotReadable(this.path));
        } else {
          reject(error);
        }
      });
      readline.on('line', (line) => {
        const match = line.match(regexp);
        if (match && match.length === 3 && isIP(match[1]!)) {
          pairs.push([match[2]!, match[1]!]);
        }
      });
    });
  }

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
   * import { UniversalHostsFileService } from 'super-dns-lookup';
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
  public watch(updateHandler: () => Promise<void> | void): void {
    if (this.updateHandler) {
      throw new HostsFileAlreadyWatched(this.path);
    }
    this.updateHandler = updateHandler;
    this.startWatchProcess();
  }

  /**
   * Interrupts watching for hosts file changes, `updateHandler` callback will not called anymore despite hosts file changes.
   *
   * Method is used by {@link LookupController#teardown} to stop watching for hosts file changes.
   *
   * @example
   * import { UniversalHostsFileService } from 'super-dns-lookup';
   *
   * const hostsFileService new UniversalHostsFileService();
   * let pairs = await hostsFileService.read();
   * hostsFileService.watch(async () => {
   *   pairs = await hostsFileService.read();
   * });
   * // watch for updates during next hour only
   * setTimeout(() => hostsFileService.stopWatching(), 3600_1000)
   * @returns Nothing.
   */
  public stopWatching(): void {
    this.updateHandler = undefined;
    this.stopProbeProcess();
    this.stopWatchProcess();
  }

  protected callUpdateHandler() {
    const updateHandler = this.updateHandler;
    if (typeof updateHandler !== 'function') {
      throw new TypeError('Update handler must be a function');
    }
    try {
      const promise = updateHandler();
      if (promise) {
        promise.catch((error) => this.emit('error', error));
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  protected isFileReadable(callback: (readable: boolean) => void): void;
  protected isFileReadable(): Promise<boolean>;
  protected isFileReadable(callback?: (readable: boolean) => void): Promise<boolean> | void {
    const isFileReadable = (callback: (readable: boolean) => void) => {
      stat(this.path, (error, stats) => {
        if (error) {
          callback(false);
        } else if (!stats.isFile()) {
          callback(false);
        } else {
          access(this.path, constants.R_OK, (error) => {
            callback(!Boolean(error));
          });
        }
      });
    };

    if (callback) {
      return isFileReadable(callback);
    }

    return new Promise((resolve) => {
      isFileReadable(resolve);
    });
  }

  protected isWatchProcessRunning() {
    return Boolean(this.watcher);
  }

  protected startWatchProcess() {
    try {
      this.watcher = watch(this.path, { persistent: false }, () => {
        this.isFileReadable((readable) => {
          if (!this.isWatchProcessRunning()) {
            return;
          }
          this.callUpdateHandler();
          if (!readable) {
            this.stopWatchProcess();
            this.startProbeProcess();
          }
        });
      });
    } catch (error) {
      this.stopWatchProcess();
      this.startProbeProcess();
    }
  }

  protected stopWatchProcess() {
    this.watcher?.close();
    this.watcher = undefined;
  }

  protected isProbeProcessRunning() {
    return Boolean(this.probeInterval);
  }

  protected startProbeProcess() {
    const probe = () => {
      this.isFileReadable((readable) => {
        if (!this.isProbeProcessRunning()) {
          return;
        }
        if (readable) {
          this.callUpdateHandler();
          this.stopProbeProcess();
          this.startWatchProcess();
        }
      });
    };
    this.probeInterval = setInterval(probe, this.probeIntervalMs);
  }

  protected stopProbeProcess() {
    clearInterval(this.probeInterval);
    this.probeInterval = undefined;
  }
}
