import { deepEqual, doesNotReject, equal } from 'node:assert';
import { ADDRCONFIG, ALL, V4MAPPED, lookup } from 'node:dns';
import { lookup as lookupPromised } from 'node:dns/promises';
import { createServer as createHttpServer, request as createHttpRequest } from 'node:http';
import { createServer as createTcpServer, createConnection as createTcpSocket } from 'node:net';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { inspect } from 'node:util';
import { family } from 'detect-libc';
import { dnsServer } from './util';
import { SuperLookupController } from '../lib';

describe('SuperLookupController', () => {
  afterEach(async () => {
    mock.reset();
    await dnsServer.reset();
  });

  describe('#bootstrap', () => {});

  describe('#teardown', () => {});

  describe('#install', () => {});

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

    class CompatibilityTestError extends Error {
      public constructor(params: unknown[], error: unknown) {
        if (typeof params[1] === 'object' && params[1] !== null) {
          const hostname = params[0];
          const options = params[1];
          if ('hints' in options && typeof options.hints === 'number') {
            const hints = options.hints;
            const hintsList: string[] = [];
            if ((hints & ADDRCONFIG) === ADDRCONFIG) {
              hintsList.push('ADDRCONFIG');
            }
            if ((hints & V4MAPPED) === V4MAPPED) {
              hintsList.push('V4MAPPED');
            }
            if ((hints & ALL) === ALL) {
              hintsList.push('ALL');
            }
            params = [hostname, { ...options, hints: hintsList.join(' & ') }, ...params.slice(2)];
          }
        }
        const message = `Failed with params: ${inspect(params)}`;
        super(message, { cause: error });
      }
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

    it('Return same result as built-in dns.lookup', async () => {
      const controller = new SuperLookupController({ libcCompatibilityName: await family() });
      for (const params of lookupParamsVariants) {
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
      }
    });

    it('Return same result as built-in dns/promises.lookup', async () => {
      const handleResponse = (result: unknown) => [null, result];
      const handleError = (error: unknown) => [error];
      const controller = new SuperLookupController({ libcCompatibilityName: await family() });
      for (const params of lookupParamsVariants.slice(0, 1)) {
        // @ts-expect-error ts(2556)
        const superLookupResponse = await controller.lookup(...params).then(handleResponse, handleError);
        // @ts-expect-error ts(2556)
        const lookupResponse = await lookupPromised(...params).then(handleResponse, handleError);
        matchResponses(params, superLookupResponse, lookupResponse);
      }
    });
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
