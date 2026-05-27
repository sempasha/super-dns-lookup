import { deepEqual, equal, ok, rejects } from 'node:assert';
import { appendFile, chmod, rename, unlink } from 'node:fs/promises';
import os from 'node:os';
import { afterEach, describe, it, mock } from 'node:test';
import { file as createTmpFile, tmpName as createTmpFileName } from 'tmp-promise';
import { HostsFileNotFound, HostsFileNotReadable, UniversalHostsFileService } from '../';
import { delay } from './lib';

describe('UniversalHostsFileService', () => {
  describe('#constructor', () => {
    afterEach(() => {
      mock.restoreAll();
    });

    it('Creates universal hosts file service with specified file path.', () => {
      const service = new UniversalHostsFileService({ path: '/path/to/hosts' });
      equal(service.path, '/path/to/hosts');
    });

    it('Assumes that hosts file is located at /etc/hosts for FreeBSD, Linux, MacOS and OpenDSB.', () => {
      const platform = mock.method(os, 'platform');
      for (const platformName of ['darwin', 'freebsd', 'linux', 'openbsd'] as const) {
        platform.mock.mockImplementation(() => platformName);
        const service = new UniversalHostsFileService();
        equal(service.path, '/etc/hosts');
      }
    });

    it('Assumes that hosts file is located at C:\\Windows\\System32\\drivers\\etc\\hosts for Windows.', () => {
      mock.method(os, 'platform').mock.mockImplementation(() => 'win32');
      const service = new UniversalHostsFileService();
      equal(service.path, 'C:\\Windows\\System32\\drivers\\etc\\hosts');
    });
  });

  describe('#read', () => {
    it('Reads hosts file to get all hostname/address pairs from the file.', async () => {
      const hostsFile = await createTmpFile();
      const service = new UniversalHostsFileService({ path: hostsFile.path });

      try {
        await appendFile(hostsFile.path, `127.0.0.1 localhost${os.EOL}`);
        await appendFile(hostsFile.path, `::1 localhost${os.EOL}`);
        await appendFile(hostsFile.path, `23.215.0.136 example.com${os.EOL}`);
        await appendFile(hostsFile.path, `23.215.0.138 example.com${os.EOL}`);
        const result = await service.read();
        deepEqual(result, [
          ['localhost', '127.0.0.1'],
          ['localhost', '::1'],
          ['example.com', '23.215.0.136'],
          ['example.com', '23.215.0.138']
        ]);
      } finally {
        await hostsFile.cleanup();
      }
    });

    it('Throws HostsFileNotFound error when hosts file not found.', async () => {
      const path = '/unknown/hosts/file';
      const service = new UniversalHostsFileService({ path });
      await rejects(service.read(), new HostsFileNotFound(path));
    });

    it('Throws HostsFileNotReadable error when file reading is not possible (because the lack of permissions for example).', async () => {
      const hostsFile = await createTmpFile();
      const service = new UniversalHostsFileService({ path: hostsFile.path });

      try {
        await chmod(hostsFile.path, '0222');
        await rejects(service.read(), new HostsFileNotReadable(hostsFile.path));
      } finally {
        await hostsFile.cleanup();
      }
    });
  });

  describe('#stopWatch', () => {
    it('Interrupts watching for hosts file changes, `updateHandler` callback will not called anymore despite hosts file changes.', async () => {
      const hostsFile = await createTmpFile();
      const service = new UniversalHostsFileService({ path: hostsFile.path });
      const updateHandler = mock.fn(() => undefined);
      try {
        service.watch(updateHandler);
        service.stopWatching();

        await appendFile(hostsFile.path, '# comment', { encoding: 'utf-8' });
        equal(updateHandler.mock.callCount(), 0);
      } finally {
        hostsFile.cleanup();
      }
    });
  });

  describe('#watch', () => {
    it('Starts watching for hosts file changes.', async () => {
      const hostsFile = await createTmpFile();
      const service = new UniversalHostsFileService({ path: hostsFile.path });
      const updateHandler = mock.fn(() => undefined);
      try {
        service.watch(updateHandler);
        await appendFile(hostsFile.path, '# comment 1', { encoding: 'utf-8' });
        await appendFile(hostsFile.path, '# comment 2', { encoding: 'utf-8' });
        await delay(100);
        ok(updateHandler.mock.callCount() > 0);
      } finally {
        service.stopWatching();
        await hostsFile.cleanup();
      }
    });

    it('Calls `updateHandler` function on every change of hosts file after watch has been started.', async () => {
      const hostsFile = await createTmpFile();
      const service = new UniversalHostsFileService({ path: hostsFile.path });
      const updateHandler = mock.fn(() => undefined);
      try {
        service.watch(updateHandler);

        await appendFile(hostsFile.path, '# comment 1', { encoding: 'utf-8', flush: true });
        await delay(200);
        equal(updateHandler.mock.callCount(), 1);
        deepEqual(updateHandler.mock.calls[0]!.arguments, []);

        await appendFile(hostsFile.path, '# comment 2', { encoding: 'utf-8', flush: true });
        await delay(1000);
        equal(updateHandler.mock.callCount(), 2);
        deepEqual(updateHandler.mock.calls[1]!.arguments, []);
      } finally {
        service.stopWatching();
        await hostsFile.cleanup();
      }
    });

    it('Calls `updateHandler` function when file has been renamed (deleted).', async () => {
      const hostsFilePath = await createTmpFileName();
      await appendFile(hostsFilePath, '# this file will be renamed', { encoding: 'utf-8' });
      const service = new UniversalHostsFileService({ path: hostsFilePath });
      const updateHandler = mock.fn(() => undefined);

      try {
        service.watch(updateHandler);
        equal(updateHandler.mock.callCount(), 0);

        await unlink(hostsFilePath);
        await delay(100);
        equal(updateHandler.mock.callCount(), 1);
      } finally {
        service.stopWatching();
        await unlink(hostsFilePath).catch(() => undefined);
      }
    });

    it('Calls `updateHandler` function when file has been renamed (moved).', async () => {
      const hostsFilePath = await createTmpFileName();
      await appendFile(hostsFilePath, '# this file will be renamed', { encoding: 'utf-8' });
      const service = new UniversalHostsFileService({ path: hostsFilePath });
      const updateHandler = mock.fn(() => undefined);

      try {
        service.watch(updateHandler);
        equal(updateHandler.mock.callCount(), 0);

        await rename(hostsFilePath, `${hostsFilePath}.backup`);
        await delay(100);
        equal(updateHandler.mock.callCount(), 1);
      } finally {
        service.stopWatching();
        await unlink(hostsFilePath).catch(() => undefined);
        await unlink(`${hostsFilePath}.backup`).catch(() => undefined);
      }
    });

    it('When new hosts file has appeared instead of renamed one, calls `updateHandler` function and continue watch.', async () => {
      const hostsFilePath = await createTmpFileName();
      await appendFile(hostsFilePath, '# this file will be renamed', { encoding: 'utf-8' });
      const service = new UniversalHostsFileService({ path: hostsFilePath, probeIntervalMs: 100 });
      const updateHandler = mock.fn(() => undefined);

      try {
        service.watch(updateHandler);
        equal(updateHandler.mock.callCount(), 0);

        await rename(hostsFilePath, `${hostsFilePath}.backup`);
        await delay(100);
        equal(updateHandler.mock.callCount(), 1);

        await appendFile(hostsFilePath, '# this new file', { encoding: 'utf-8' });
        await delay(150);
        equal(updateHandler.mock.callCount(), 2);
      } finally {
        service.stopWatching();
        await unlink(hostsFilePath).catch(() => undefined);
        await unlink(`${hostsFilePath}.backup`).catch(() => undefined);
      }
    });

    it('When hosts file not exists, calls `updateHandler` when hosts file appears.', async () => {
      const hostsFilePath = await createTmpFileName();
      const service = new UniversalHostsFileService({ path: hostsFilePath, probeIntervalMs: 100 });
      const updateHandler = mock.fn(() => undefined);

      try {
        service.watch(updateHandler);
        equal(updateHandler.mock.callCount(), 0);

        await appendFile(hostsFilePath, '# this file will be renamed', { encoding: 'utf-8' });
        await delay(150);
        equal(updateHandler.mock.callCount(), 1);
      } finally {
        service.stopWatching();
        await unlink(hostsFilePath).catch(() => undefined);
      }
    });

    it("Emits 'error' event when error occurred in `updateHandler` (supports sync and async `updateHandlers`).", async () => {
      const hostsFile = await createTmpFile();
      const service = new UniversalHostsFileService({ path: hostsFile.path });

      try {
        try {
          const error = new Error('Sync update handler error');
          const capturedErrors: unknown[] = [];
          service.on('error', (error) => capturedErrors.push(error));
          service.watch(() => {
            throw error;
          });
          equal(capturedErrors.length, 0);

          await appendFile(hostsFile.path, '# first update', { encoding: 'utf-8' });
          await delay(100);
          equal(capturedErrors.length, 1);
          equal(capturedErrors[0], error);
        } finally {
          service.stopWatching();
        }

        try {
          const error = new Error('Async update handler error');
          const capturedErrors: unknown[] = [];
          service.on('error', (error) => capturedErrors.push(error));
          service.watch(async () => Promise.reject(error));
          equal(capturedErrors.length, 0);

          await appendFile(hostsFile.path, '# second update', { encoding: 'utf-8' });
          await delay(100);
          equal(capturedErrors.length, 1);
          equal(capturedErrors[0], error);
        } finally {
          service.stopWatching();
        }
      } finally {
        hostsFile.cleanup();
      }
    });

    it('Watcher process does not block process from existing.', async () => {
      const hostsFile = await createTmpFile();
      const service = new UniversalHostsFileService({ path: hostsFile.path });
      const getActiveHandles = () => (process as unknown as { _getActiveHandles: () => unknown[] })._getActiveHandles();

      try {
        const handlesBefore = getActiveHandles();
        service.watch(() => undefined);
        const handlesAfter = getActiveHandles();
        equal(handlesAfter.length, handlesBefore.length);
      } finally {
        service.stopWatching();
        await hostsFile.cleanup();
      }
    });
  });
});
