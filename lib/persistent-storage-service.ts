/**
 * PersistentStorageService is a simple storage service.
 * LookupController uses it by default to load initial cache data and save cache data for future usage.
 *
 * @example
 * import { readFile, writeFile } from 'node:fs/promise';
 * import { PersistentStorageService } from 'super-dns-lookup';
 *
 * export class PersistentStorageServiceExample<Data extends unknown = unknown> implements PersistentStorageService<Data> {
 *   public constructor(
 *     public readonly path = '/storage',
 *   ) {}
 *
 *   public async read(): Promise<Data | undefined> {
 *     const jsonString = await readFile(this.path, { encoding: 'utf-8' });
 *     return JSON.parse(jsonString);
 *   }
 *
 *   public async write(data: Data): Promise<void> {
 *     const jsonString = JSON.stringify(data);
 *     return writeFile(this.path, jsonString, { encoding: 'utf-8' });
 *   }
 * }
 */
export interface PersistentStorageService {
  /**
   * Should read data from storage and return promise of this data.
   * Should return nothing (undefined) in case there is no data stored.
   *
   * @example
   * import { PersistentStorageServiceExample } from './persistent-storage-service-example';
   *
   * const persistentStorageService = new PersistentStorageServiceExample();
   * const data = await persistentStorageService.read();
   * console.log('initial cache data is `, data);
   * @returns Promise of read data or nothing.
   */
  read(): Promise<unknown | undefined>;

  /**
   * Should store data for future using.
   *
   * @example
   * import { PersistentStorageServiceExample } from './persistent-storage-service-example';
   *
   * const persistentStorageService = new PersistentStorageServiceExample();
   * const data = ['initial', 'cache', 'data';
   * const data = await persistentStorageService.write(data);
   * @param data Data to store.
   * @returns Promise of write operation to be done.
   */
  write(data: unknown): Promise<void>;
}
