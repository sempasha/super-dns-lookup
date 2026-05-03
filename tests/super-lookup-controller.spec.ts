import { deepEqual, doesNotReject, equal, rejects } from 'node:assert';
import { ADDRCONFIG, ALL, V4MAPPED, lookup } from 'node:dns';
import { lookup as lookupPromised } from 'node:dns/promises';
import { createServer as createHttpServer, request as createHttpRequest } from 'node:http';
import { createServer as createTcpServer, createConnection as createTcpSocket } from 'node:net';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { inspect } from 'node:util';
import { family } from 'detect-libc';
import { delay, dnsServer } from './util';
import {
  CacheService,
  HostnameAddressPair,
  HostsFileNotFound,
  HostsFileNotReadable,
  HostsFileService,
  InvalidHostnameAddressPair,
  LookupError,
  PersistentStorageService,
  SuperLookupController
} from '../';
import { EventEmitter } from 'node:stream';

describe('SuperLookupController', () => {
  class Cache extends Map implements CacheService {}

  class HostsFile extends EventEmitter<{ error: [unknown] }> implements HostsFileService {
    public readonly path = '/etc/hosts';
    private updateHandler: (() => Promise<void> | void) | undefined;
    public constructor(private pairs: HostnameAddressPair[] = []) {
      super();
    }
    public async read(): Promise<HostnameAddressPair[]> {
      return this.pairs;
    }
    public stopWatching(): void {}
    public watch(updateHandler: () => Promise<void> | void): void {
      this.updateHandler = updateHandler;
    }
    public triggerChange(pairs: HostnameAddressPair[] = this.pairs) {
      const { updateHandler } = this;
      this.pairs = pairs;
      if (updateHandler) {
        updateHandler();
      }
    }
  }

  class PersistentStorage implements PersistentStorageService {
    public constructor(private data: unknown = []) {}
    public async read() {
      return this.data;
    }
    public async write(data: unknown) {
      this.data = data;
    }
  }

  const expiresAt = new Date('2100-01-01T00:00:00.000Z').getTime();

  afterEach(async () => {
    mock.reset();
    await dnsServer.reset();
  });

  describe('#bootstrap', () => {
    it('Preloads cache using {@link PersistentStorageService#read} when service provided.', async () => {
      const cacheService = new Cache();
      const data = [['example.com', { 4: { actual: [{ address: '192.168.0.1', expiresAt }] } }]];
      const persistentStorageService = new PersistentStorage(data);
      const controller = new SuperLookupController({
        cacheService,
        isIpService: null,
        hostsFileService: null,
        persistentStorageService,
        resolverService: null
      });
      try {
        const read = mock.method(persistentStorageService, 'read');
        await controller.bootstrap();
        equal(read.mock.callCount(), 1);
        deepEqual(Array.from(cacheService.keys()), ['example.com']);
      } finally {
        await controller.teardown();
      }
    });

    it(
      'When records read from {@link PersistentStorageService} do not match the {@link HostnameRecord} interface ' +
        'that {@link CacheService} expects, they are skipped.',
      async () => {
        const cacheService = new Cache();
        const data = [
          ['invalid1.example.com', 'invalid record'],
          ['invalid2.example.com', { 4: { actual: [{ host: '192.168.0.1', expiresAt }] } }],
          ['invalid3.example.com', { 4: { actual: [{ address: '192.168.0.1', expiresAt: '2100-01-01T00:00:00Z' }] } }],
          ['invalid4.example.com', { 4: { actual: [{ address: '2001:db8::1', expiresAt }] } }],
          ['invalid5.example.com', { 6: { actual: [{ address: '192.168.0.1', expiresAt }] } }],
          ['valid.example.com', { 4: { actual: [{ address: '192.168.0.1', expiresAt }] } }]
        ];
        const persistentStorageService = new PersistentStorage(data);
        const controller = new SuperLookupController({
          cacheService,
          isIpService: null,
          hostsFileService: null,
          persistentStorageService,
          resolverService: null
        });
        try {
          await controller.bootstrap();
          deepEqual(Array.from(cacheService.keys()), ['valid.example.com']);
        } finally {
          await controller.teardown();
        }
      }
    );

    it('Reads hosts file using {@link HostsFileService#read}.', async () => {
      const hostsFileService = new HostsFile([['example.com', '192.168.0.1']]);
      const controller = new SuperLookupController({
        cacheService: null,
        isIpService: null,
        hostsFileService,
        persistentStorageService: null,
        resolverService: null
      });
      try {
        const read = mock.method(hostsFileService, 'read');
        await controller.bootstrap();
        equal(read.mock.callCount(), 1);
        deepEqual(await controller.lookup('example.com'), { address: '192.168.0.1', family: 4 });
      } finally {
        await controller.teardown();
      }
    });

    it('Reads all hostname/address pairs from hosts file.', async () => {
      const hostsFileService = new HostsFile([
        ['example.com', '192.168.0.1'],
        ['google.com', '192.168.0.2'],
        ['github.com', '192.168.0.3']
      ]);
      const controller = new SuperLookupController({
        cacheService: null,
        isIpService: null,
        hostsFileService,
        persistentStorageService: null,
        resolverService: null
      });
      try {
        await controller.bootstrap();
        deepEqual(await controller.lookup('example.com'), { address: '192.168.0.1', family: 4 });
        deepEqual(await controller.lookup('google.com'), { address: '192.168.0.2', family: 4 });
        deepEqual(await controller.lookup('github.com'), { address: '192.168.0.3', family: 4 });
      } finally {
        await controller.teardown();
      }
    });

    it('When pair has unrecognizable address, skips the pair and emits {@link InvalidHostnameAddressPair} error.', async () => {
      const hostsFileService = new HostsFile([
        ['example.com', '192.168.0.1'],
        ['google.com', '192.168.0.2222'],
        ['github.com', '192.168.0.3333']
      ]);
      const controller = new SuperLookupController({
        cacheService: null,
        isIpService: null,
        hostsFileService,
        persistentStorageService: null,
        resolverService: null
      });
      try {
        const emittedErrors: unknown[] = [];
        controller.on('error', (error) => emittedErrors.push(error));
        await controller.bootstrap();
        deepEqual(await controller.lookup('example.com'), { address: '192.168.0.1', family: 4 });
        rejects(controller.lookup('google.com'));
        rejects(controller.lookup('github.com'));
        deepEqual(emittedErrors, [
          new InvalidHostnameAddressPair(hostsFileService.path, ['google.com', '192.168.0.2222']),
          new InvalidHostnameAddressPair(hostsFileService.path, ['github.com', '192.168.0.3333'])
        ]);
      } finally {
        await controller.teardown();
      }
    });

    it(
      'When {@link HostsFileService#read} has been rejected with error, ' +
        'assumes hosts file is empty and emits reading error.',
      async () => {
        const readError = new Error('Read error');
        const hostsFileService = new HostsFile([['example.com', '192.168.0.1']]);
        mock.method(hostsFileService, 'read').mock.mockImplementationOnce(() => {
          throw readError;
        });
        const controller = new SuperLookupController({
          cacheService: null,
          isIpService: null,
          hostsFileService,
          persistentStorageService: null,
          resolverService: null
        });
        try {
          const emittedErrors: unknown[] = [];
          controller.on('error', (error) => emittedErrors.push(error));
          await controller.bootstrap();
          rejects(controller.lookup('example.com'));
          deepEqual(emittedErrors, [readError]);
        } finally {
          await controller.teardown();
        }
      }
    );

    it('Starts watching for hosts file using {@link HostsFileService#watch} before reading the file.', async () => {
      const hostsFileService = new HostsFile([['example.com', '192.168.0.1']]);
      const controller = new SuperLookupController({
        cacheService: null,
        isIpService: null,
        hostsFileService,
        persistentStorageService: null,
        resolverService: null
      });
      try {
        await controller.bootstrap();
        const read = mock.method(hostsFileService, 'read');
        hostsFileService.triggerChange([['example.com', '192.168.1.1']]);
        await delay(0);
        equal(read.mock.callCount(), 1);
        deepEqual(await controller.lookup('example.com'), { address: '192.168.1.1', family: 4 });
      } finally {
        await controller.teardown();
      }
    });

    it('While watching {@link LookupController} should read hosts file on every hosts file change.', async () => {
      const hostsFileService = new HostsFile([['example.com', '192.168.0.1']]);
      const controller = new SuperLookupController({
        cacheService: null,
        isIpService: null,
        hostsFileService,
        persistentStorageService: null,
        resolverService: null
      });
      try {
        await controller.bootstrap();
        const read = mock.method(hostsFileService, 'read');
        for (let i = 0; i < 10; i++) {
          const address = `192.168.1.${i + 1}`;
          hostsFileService.triggerChange([['example.com', address]]);
          await delay(0);
          equal(read.mock.callCount(), i + 1);
          deepEqual(await controller.lookup('example.com'), { address, family: 4 });
        }
      } finally {
        await controller.teardown();
      }
    });

    it(
      'While reading hosts file data, {@link LookupController} should consider {@link HostsFileNotFound} ' +
        'as a signal to forget all the data previously loaded from hosts file.',
      async () => {
        const hostsFileService = new HostsFile([['example.com', '192.168.0.1']]);
        const controller = new SuperLookupController({
          cacheService: null,
          isIpService: null,
          hostsFileService,
          persistentStorageService: null,
          resolverService: null
        });
        controller.on('error', () => undefined);
        try {
          await controller.bootstrap();
          deepEqual(await controller.lookup('example.com'), { address: '192.168.0.1', family: 4 });
          mock.method(hostsFileService, 'read').mock.mockImplementationOnce(() => {
            throw new HostsFileNotFound('/etc/example.com');
          });
          hostsFileService.triggerChange();
          rejects(controller.lookup('example.com'), new LookupError('example.com', {}, 'ENOTFOUND'));
        } finally {
          await controller.teardown();
        }
      }
    );

    it(
      'Error {@link HostsFileNotReadable} should be considered as a signal to stop reading file ' +
        'and keep previously read data.',
      async () => {
        const hostsFileService = new HostsFile([['example.com', '192.168.0.1']]);
        const controller = new SuperLookupController({ hostsFileService });
        controller.on('error', () => undefined);
        try {
          await controller.bootstrap();
          deepEqual(await controller.lookup('example.com'), { address: '192.168.0.1', family: 4 });
          mock.method(hostsFileService, 'read').mock.mockImplementationOnce(() => {
            throw new HostsFileNotReadable('/etc/example.com');
          });
          hostsFileService.triggerChange();
          deepEqual(await controller.lookup('example.com'), { address: '192.168.0.1', family: 4 });
        } finally {
          await controller.teardown();
        }
      }
    );

    it(
      'Enables process event listeners specified by {@link SuperLookupControllerOptions#lazyTeardown} option ' +
        'which will trigger {@link SuperLookupController#teardown}.',
      async () => {
        const signal = 'SIGUSR1';
        const controller = new SuperLookupController({
          lazyTeardown: [signal]
        });
        const teardown = mock.method(controller, 'teardown');
        try {
          await controller.bootstrap();
          equal(teardown.mock.callCount(), 0);
          process.emit(signal, signal);
          equal(teardown.mock.callCount(), 1);
        } finally {
          await controller.teardown();
        }
      }
    );
  });

  describe('#teardown', () => {
    it(
      'If {@link LookupController#bootstrap} has been called, ' +
        'controller will stop watching for hosts file changes by calling {@link HostsFileService#stopWatching}.',
      async () => {
        const signal = 'SIGUSR1';
        const controller = new SuperLookupController({
          lazyTeardown: [signal]
        });
        try {
          await controller.bootstrap();
          await controller.teardown();
          const teardown = mock.method(controller, 'teardown');
          process.emit(signal, signal);
          equal(teardown.mock.callCount(), 0);
        } finally {
          await controller.teardown();
        }
      }
    );

    it(
      'If persistent storage has been configured with {@link SuperLookupControllerOptions#persistentStorageService}, ' +
        'controller will read entire cache using {@link CacheService#entries}, serialize everything into single data object and will write it out using {@link PersistentStorageService#write}.',
      async () => {
        const cacheService = new Cache();
        const initialData = [
          [
            'example.com',
            {
              4: { actual: [{ address: '192.186.0.1', expiresAt }] },
              6: { actual: [{ address: '2001:db8::1', expiresAt }] }
            }
          ]
        ];
        const persistentStorageService = new PersistentStorage(initialData);
        const controller = new SuperLookupController({
          cacheService,
          hostsFileService: null,
          persistentStorageService,
          resolverService: null
        });
        try {
          await controller.bootstrap();
          const write = mock.method(persistentStorageService, 'write');
          await controller.teardown();
          equal(write.mock.callCount(), 1);
          deepEqual(write.mock.calls[0]?.arguments, [initialData]);
        } finally {
          await controller.teardown();
        }
      }
    );
  });

  describe('#lookup', () => {
    it('Method is hard bound to {@link SuperLookupController} instance.', async () => {
      await dnsServer.respondAlways('example.com', {
        A: [['192.186.0.1', 100]],
        AAAA: [['2001:db8::1', 100]]
      });

      const controller = new SuperLookupController();
      const lookup = controller.lookup;
      await doesNotReject(lookup('example.com'));
    });
  });

  describe('node:dns.lookup compatibility', () => {
    beforeEach(async () => {
      await dnsServer.respondAlways('example.com', {
        A: [['192.186.0.1', 100]],
        AAAA: [['2001:db8::1', 100]]
      });
      await dnsServer.respondAlways('ipv4.example.com', {
        A: [['192.186.0.2', 100]]
      });
      await dnsServer.respondAlways('ipv6.example.com', {
        AAAA: [['2001:db9::1', 100]]
      });
    });

    const lookupParamsVariants: unknown[][] = [
      'example.com',
      'ipv4.example.com',
      'ipv6.example.com',
      'unknown.example.com'
    ].flatMap((hostname) => [
      [hostname],
      [hostname, 0],
      [hostname, 4],
      [hostname, 6],
      [hostname, { family: 0 }],
      [hostname, { family: 4 }],
      [hostname, { family: 6 }],
      [hostname, { family: 'IPv4' }],
      [hostname, { family: 'IPv6' }],
      [hostname, { hints: ADDRCONFIG }],
      [hostname, { family: 4, hints: ADDRCONFIG }],
      [hostname, { family: 0, hints: ADDRCONFIG }],
      [hostname, { all: false }],
      [hostname, { all: true }],
      [hostname, { all: true, family: 0 }],
      [hostname, { all: true, family: 4 }],
      [hostname, { all: true, family: 6 }],
      [hostname, { all: true, verbatim: true }],
      [hostname, { all: true, verbatim: false }],
      [hostname, { all: true, order: 'verbatim' }],
      [hostname, { all: true, order: 'ipv4first' }],
      [hostname, { all: true, hints: ADDRCONFIG }],
      [hostname, { all: true, family: 4, hints: ADDRCONFIG }],
      [hostname, { all: true, family: 6, hints: ADDRCONFIG }],
      [hostname, { all: true, hints: V4MAPPED }],
      [hostname, { all: true, family: 4, hints: V4MAPPED }],
      [hostname, { all: true, family: 6, hints: V4MAPPED }],
      [hostname, { all: true, hints: V4MAPPED | ALL }],
      [hostname, { all: true, family: 4, hints: V4MAPPED | ALL }],
      [hostname, { all: true, family: 6, hints: V4MAPPED | ALL }]
    ]);

    for (const params of lookupParamsVariants) {
      it(`Return same result as built-in dns.lookup called with ${paramsToString(params)}`, async () => {
        const controller = new SuperLookupController({ libcCompatibilityName: await family() });
        const superLookupResponse = await new Promise<unknown[]>((resolve) => {
          const callback = (...response: unknown[]) => resolve(response);
          // @ts-expect-error ts(2556)
          controller.lookup(...(params as any), callback);
        });
        const lookupResponse = await new Promise<unknown[]>((resolve) => {
          const callback = (...response: unknown[]) => resolve(response);
          // @ts-expect-error ts(2556)
          lookup(...params, callback);
        });
        matchResponses(params, superLookupResponse, lookupResponse);
      });
    }

    function nonStringFamily(params: unknown[]) {
      const options = params[1];
      if (typeof options === 'string') {
        return false;
      }
      if (
        typeof options === 'object' &&
        options !== null &&
        'family' in options &&
        typeof options.family === 'string'
      ) {
        return false;
      }
      return true;
    }

    for (const params of lookupParamsVariants.filter(nonStringFamily)) {
      it(`Return same result as built-in dns/promises.lookup called with ${paramsToString(params)}`, async () => {
        const handleResponse = (result: unknown) => [null, result];
        const handleError = (error: unknown) => [error];
        const controller = new SuperLookupController({ libcCompatibilityName: await family() });
        // @ts-expect-error ts(2556)
        const superLookupResponse = await controller.lookup(...params).then(handleResponse, handleError);
        // @ts-expect-error ts(2556)
        const lookupResponse = await lookupPromised(...params).then(handleResponse, handleError);
        matchResponses(params, superLookupResponse, lookupResponse);
      });
    }

    class CompatibilityTestError extends Error {
      public constructor(params: unknown[], error: unknown) {
        super(`Failed with params: ${paramsToString(params)}`, { cause: error });
      }
    }

    function paramsToString(params: unknown[]) {
      if (typeof params[1] === 'object' && params[1] !== null) {
        const hostname = params[0];
        const options = params[1];
        if ('hints' in options && typeof options.hints === 'number') {
          params = [hostname, { ...options, hints: hintsToString(options.hints) }, ...params.slice(2)];
        }
      }
      return inspect(params);
    }

    function hintsToString(hints: number): string {
      const strings: string[] = [];
      if ((hints & ADDRCONFIG) === ADDRCONFIG) {
        strings.push('ADDRCONFIG');
      }
      if ((hints & V4MAPPED) === V4MAPPED) {
        strings.push('V4MAPPED');
      }
      if ((hints & ALL) === ALL) {
        strings.push('ALL');
      }
      return strings.join(' & ');
    }

    function matchResponses(params: unknown[], superLookupResponse: unknown[], lookupResponse: unknown[]) {
      try {
        if (superLookupResponse[0] instanceof Error && lookupResponse[0] instanceof Error) {
          const getErrorCode = (error: Error) =>
            'code' in error && typeof error.code === 'string' ? error.code : 'undefined';
          const superLookupErrorCode = getErrorCode(superLookupResponse[0]);
          const lookupErrorCode = getErrorCode(lookupResponse[0]);
          equal(superLookupErrorCode, lookupErrorCode);
        } else {
          deepEqual(superLookupResponse, lookupResponse);
        }
      } catch (error) {
        throw new CompatibilityTestError(params, error);
      }
    }
  });

  describe('node:http.request compatibility', () => {
    it('Has signature compatible with lookup option of http.request method', async () => {
      await dnsServer.respondAlways('example.com', {
        A: [['127.0.0.1', 100]]
      });

      let server: ReturnType<typeof createHttpServer>;
      await new Promise<void>((resolve) => {
        server = createHttpServer();
        server.on('request', (_, res) => {
          res.writeHead(200);
          res.end();
        });
        server.listen(80, '127.0.0.1', resolve);
      });

      try {
        const controller = new SuperLookupController();
        const req = createHttpRequest('http://example.com', { lookup: controller.lookup });
        const statusCode = await new Promise<number | undefined>((resolve, reject) => {
          req.on('error', reject);
          req.on('response', (res) => {
            res.on('close', () => resolve(res.statusCode));
            res.on('data', () => {});
            res.on('error', reject);
          });
          req.end();
        });
        equal(statusCode, 200);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  describe('net.Socket#connect compatibility', () => {
    it('Has signature compatible with lookup option of net.Socket#connect (createConnection) method', async () => {
      await dnsServer.respondAlways('example.com', {
        A: [['127.0.0.1', 100]]
      });

      let server: ReturnType<typeof createTcpServer>;
      await new Promise<void>((resolve) => {
        server = createTcpServer();
        server.on('connection', (socket) => {
          socket.write('Hello, world!');
          socket.end();
        });
        server.listen(81, '127.0.0.1', resolve);
      });

      try {
        const controller = new SuperLookupController();
        const socket = createTcpSocket({
          host: 'example.com',
          port: 81,
          lookup: controller.lookup
        });
        const data = await new Promise((resolve, reject) => {
          let chunks: Buffer[] = [];
          socket.on('data', (chunk) => chunks.push(chunk));
          socket.on('close', () => resolve(Buffer.concat(chunks).toString('utf-8')));
          socket.on('error', reject);
          socket.end();
        });
        equal(data, 'Hello, world!');
      } finally {
        new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
