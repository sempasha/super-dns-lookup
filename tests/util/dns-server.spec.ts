import { deepStrictEqual, doesNotReject, equal, ok, partialDeepStrictEqual, rejects } from 'node:assert';
import { createSocket } from 'node:dgram';
import { Resolver } from 'node:dns/promises';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { encode } from 'dns-packet';
import { toRcode } from 'dns-packet/rcodes';
import { DNSServer } from './dns-server';
import { assertUUID } from './assert-uuid';
import { dnsServer } from './dns';

describe('DNSServer (used only for tests)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  describe('#bootstrap', () => {
    it('Starts listening the incoming requests on specified ip:port.', async () => {
      for (const ip of ['127.0.0.1']) {
        for (const port of [1053, 2053, 3053]) {
          const server = new DNSServer({ ip, port });
          const resolver = new Resolver({ timeout: 1000, tries: 1 });
          resolver.setServers([`[${ip}]:${port}`]);
          try {
            await server.bootstrap();
            await rejects(resolver.resolve('example.com'), { message: 'queryA ENOTFOUND example.com' });
          } finally {
            await server.teardown();
          }
        }
      }
    });
  });

  describe('#teardown', () => {
    it('Stops listening the incoming requests on specified ip:port, no more requests will be handled after teardown.', async () => {
      const server = new DNSServer({ ip: '127.0.0.1', port: 1053 });
      const resolver = new Resolver({ timeout: 1000, tries: 1 });
      resolver.setServers(['127.0.0.1:1053']);
      await server.bootstrap();
      await rejects(resolver.resolve('example.com'), { message: 'queryA ENOTFOUND example.com' });
      await server.teardown();
      await rejects(resolver.resolve('example.com'), { message: 'queryA ECONNREFUSED example.com' });
    });
  });

  describe('#reset', () => {
    it('Makes server to forget all configures responses.', async () => {
      const server = new DNSServer({ ip: '127.0.0.1', port: 1053 });
      const resolver = new Resolver({ timeout: 1000, tries: 1 });
      resolver.setServers(['127.0.0.1:1053']);
      await server.bootstrap();

      try {
        server.respondAlways('example.com', { A: [['192.168.0.1', 600]] });
        server.reset();
        await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });

        server.respondOnce('example.com', { A: [['192.168.0.1', 600]] });
        server.reset();
        await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });

        server.respondTimes(2, 'example.com', { A: [['192.168.0.1', 600]] });
        server.reset();
        await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });
      } finally {
        await server.teardown();
      }
    });
  });

  describe('#respondTimes', () => {
    it('Makes server to always respond with given response.', async () => {
      const server = new DNSServer({ ip: '127.0.0.1', port: 1053 });
      const resolver = new Resolver({ timeout: 1000, tries: 1 });
      resolver.setServers(['127.0.0.1:1053']);
      await server.bootstrap();
      try {
        server.respondTimes(3, 'example.com', 'ESERVFAIL');
        for (let i = 0; i < 3; i++) {
          await rejects(resolver.resolve('example.com'), { message: 'queryA ESERVFAIL example.com' });
        }
        await rejects(resolver.resolve('example.com'), { message: 'queryA ENOTFOUND example.com' });
      } finally {
        await server.teardown();
      }
    });
  });

  describe('#respondAlways', () => {
    it('Makes server to always respond with given response.', async () => {
      const server = new DNSServer({ ip: '127.0.0.1', port: 1053 });
      const resolver = new Resolver({ timeout: 1000, tries: 1 });
      resolver.setServers(['127.0.0.1:1053']);
      await server.bootstrap();
      try {
        server.respondAlways('example.com', 'ESERVFAIL');
        for (let i = 0; i < 9999; i++) {
          await rejects(resolver.resolve('example.com'), { message: 'queryA ESERVFAIL example.com' });
        }
      } finally {
        await server.teardown();
      }
    });

    it('This is simple alias on DNSServer#respondTimes called with given response and times=Infinity.', () => {
      const server = new DNSServer({ ip: '127.0.0.1', port: 1053 });
      const respondTimes = mock.method(server, 'respondTimes');
      server.respondAlways('example.com', 'ESERVFAIL');
      const calls = respondTimes.mock.calls;
      equal(calls.length, 1);
      deepStrictEqual(calls[0]!.arguments, [Infinity, 'example.com', 'ESERVFAIL']);
    });
  });

  describe('#respondOnce', () => {
    it('Makes server to respond with given response only once.', async () => {
      const server = new DNSServer({ ip: '127.0.0.1', port: 1053 });
      const resolver = new Resolver({ timeout: 1000, tries: 1 });
      resolver.setServers(['127.0.0.1:1053']);
      await server.bootstrap();
      try {
        server.respondOnce('example.com', 'ESERVFAIL');
        await rejects(resolver.resolve('example.com'), { message: 'queryA ESERVFAIL example.com' });
        await rejects(resolver.resolve('example.com'), { message: 'queryA ENOTFOUND example.com' });
      } finally {
        await server.teardown();
      }
    });

    it('This is simple alias on DNSServer#respondTimes called with given response and times=1.', () => {
      const server = new DNSServer({ ip: '127.0.0.1', port: 1053 });
      const respondTimes = mock.method(server, 'respondTimes');
      server.respondOnce('example.com', 'ESERVFAIL');
      const calls = respondTimes.mock.calls;
      equal(calls.length, 1);
      deepStrictEqual(calls[0]!.arguments, [1, 'example.com', 'ESERVFAIL']);
    });
  });

  describe('Request handling', () => {
    let resolver: Resolver;
    let server: DNSServer;

    beforeEach(async () => {
      resolver = new Resolver({ timeout: 250, tries: 1 });
      resolver.setServers(['127.0.0.1:1053']);
      server = new DNSServer({ ip: '127.0.0.1', port: 1053 });
      await server.bootstrap();
    });

    afterEach(async () => {
      if (server) {
        await server.teardown();
      }
    });

    it('Supports only query packets handling.', async () => {
      const socket = createSocket('udp4');
      try {
        socket.send(encode({ type: 'response', flags: toRcode('NOERROR') }), 1053, '127.0.0.1');
        const event = await new Promise((resolve) => {
          server.once('error', resolve);
        });
        ok(typeof event === 'object');
        ok(event !== null);
        ok('error' in event);
        ok(event.error instanceof Error);
        equal(event.error.message, 'DNSServer expects only "query" packets, got "response"');
      } finally {
        socket.close();
      }
    });

    it('Supports only queries with at least one question in it.', async () => {
      const socket = createSocket('udp4');
      try {
        socket.send(encode({ type: 'query', questions: [] }), 1053, '127.0.0.1');
        const event = await new Promise((resolve) => {
          server.once('error', resolve);
        });
        ok(typeof event === 'object');
        ok(event !== null);
        ok('error' in event);
        ok(event.error instanceof Error);
        equal(event.error.message, 'DNSServer expects question in query, got nothing');
      } finally {
        socket.close();
      }
    });

    it('Supports only single question in request.', async () => {
      const socket = createSocket('udp4');
      try {
        const questions = [
          { name: 'example.com', type: 'A' as const },
          { name: 'example.com', type: 'AAAA' as const }
        ];
        socket.send(encode({ type: 'query', questions }), 1053, '127.0.0.1');
        const event = await new Promise((resolve) => {
          server.once('error', resolve);
        });
        ok(typeof event === 'object');
        ok(event !== null);
        ok('error' in event);
        ok(event.error instanceof Error);
        equal(event.error.message, 'DNSServer expects only one question in query, got 2');
      } finally {
        socket.close();
      }
    });

    it('Supports only questions about "IN" record classes.', async () => {
      const socket = createSocket('udp4');
      try {
        const questions = [{ name: 'example.com', type: 'A' as const, class: 'ANY' as const }];
        socket.send(encode({ type: 'query', questions }), 1053, '127.0.0.1');
        const event = await new Promise((resolve) => {
          server.once('error', resolve);
        });
        ok(typeof event === 'object');
        ok(event !== null);
        ok('error' in event);
        ok(event.error instanceof Error);
        equal(event.error.message, 'DNSServer supports only questions of class "IN", got "ANY"');
      } finally {
        socket.close();
      }
    });

    it('Supports only questions about "A"/"AAAA" record types.', { timeout: 10000 }, async () => {
      let error: unknown | undefined;
      server.on('error', ({ error: e }) => (error = e));

      for (const suffix of ['4', '6'] as const) {
        await rejects(resolver[`resolve${suffix}`]('example.com'));
        equal(error, undefined);
      }

      for (const suffix of ['Any', 'Caa', 'Cname', 'Mx', 'Naptr', 'Ns', 'Ptr', 'Soa', 'Srv', 'Tlsa', 'Txt'] as const) {
        await rejects(resolver[`resolve${suffix}`]('example.com'));
        ok(error instanceof Error);
        equal(error.message, `DNSServer supports only questions of type "A" or "AAAA", got "${suffix.toUpperCase()}"`);
      }
    });

    it('When no answer configured by calling DNSServer#respondAlways/DNSServer#respondOnce/DNSServer#respondTimes, returns NX answer.', async () => {
      await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });
      await rejects(resolver.resolve6('example.com'), { message: 'queryAaaa ENOTFOUND example.com' });
    });

    it('When answer has been configured by DNSServer#respondAlways, always returns configured answer.', async () => {
      server.respondAlways('example.com', { A: [['192.168.0.1', 40]], AAAA: [['2a0b:c230:35:204c::7a6', 60]] });
      for (let i = 0; i < 9999; i++) {
        deepStrictEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
        deepStrictEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      }
    });

    it('When answer has been configured by DNSServer#respondOnce, returns configured answer only once.', async () => {
      server.respondOnce('example.com', { A: [['192.168.0.1', 40]] });
      deepStrictEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
      await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });

      server.respondOnce('example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 60]] });
      deepStrictEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      await rejects(resolver.resolve6('example.com'), { message: 'queryAaaa ENOTFOUND example.com' });
    });

    it('When answer has been configured by DNSServer#respondTimes, returns configured answer as many times as said.', async () => {
      server.respondTimes(2, 'example.com', { A: [['192.168.0.1', 40]] });
      deepStrictEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
      deepStrictEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
      await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });

      server.respondTimes(2, 'example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 60]] });
      deepStrictEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      deepStrictEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      await rejects(resolver.resolve6('example.com'), { message: 'queryAaaa ENOTFOUND example.com' });
    });

    it('When answer has been configured as error code, then returns corresponding error.', async () => {
      for (const errorCode of ['EFORMERR', 'ENOTFOUND', 'ENOTIMP', 'EREFUSED', 'ESERVFAIL'] as const) {
        server.respondOnce('example.com', errorCode);
        await rejects(resolver.resolve4('example.com'), {
          code: errorCode,
          message: `queryA ${errorCode} example.com`
        });
      }
    });

    it('When answer has been configured as A records, then returns them.', async () => {
      server.respondAlways('example.com', { A: [['192.168.0.1', 100]] });

      deepStrictEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
      deepStrictEqual(await resolver.resolve4('example.com', { ttl: true }), [{ address: '192.168.0.1', ttl: 100 }]);
      await rejects(resolver.resolve6('example.com'));
      await rejects(resolver.resolve6('example.com', { ttl: true }));
    });

    it('When answer has been configured as AAAA records, then returns them.', async () => {
      server.respondAlways('example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 100]] });
      deepStrictEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      deepStrictEqual(await resolver.resolve6('example.com', { ttl: true }), [
        { address: '2a0b:c230:35:204c::7a6', ttl: 100 }
      ]);
      await rejects(resolver.resolve4('example.com'));
      await rejects(resolver.resolve4('example.com', { ttl: true }));
    });

    it('When request should be forwarded to node.dns module, resolves hostname using NodeJS build-in resolver', async () => {
      // Additionally we must configure request forwarding on the DNSServer in {@link file://./../bin/dns-server.ts}.
      // Otherwise, built-in resolver will be unable to resolve this domain,
      // because app container is configured to use dns container as resolver.
      await dnsServer.respondAlways('example.com', 'forward to node.dns');
      server.respondAlways('example.com', 'forward to node.dns');
      await doesNotReject(resolver.resolve4('example.com'));
      await doesNotReject(resolver.resolve4('example.com', { ttl: true }));
      await doesNotReject(resolver.resolve6('example.com'));
      await doesNotReject(resolver.resolve6('example.com', { ttl: true }));
    });

    it('When error occurred during request forwarding, exposes this error to user', async () => {
      server.respondAlways('non.existing.domain.name', 'forward to node.dns');
      await rejects(resolver.resolve4('non.existing.domain.name'));
      await rejects(resolver.resolve4('non.existing.domain.name', { ttl: true }));
      await rejects(resolver.resolve6('non.existing.domain.name'));
      await rejects(resolver.resolve6('non.existing.domain.name', { ttl: true }));
    });

    it('Generate request event each time valid request accepted', async () => {
      const events: unknown[] = [];
      server.on('request', (event) => events.push(event));
      server.respondOnce('example.com', { A: [['192.168.0.1', 100]] });
      server.respondOnce('example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 100]] });
      await resolver.resolve4('example.com');
      await resolver.resolve6('example.com');

      equal(events.length, 2);

      for (const [event, type] of new Map([
        [events[0], 'A'],
        [events[1], 'AAAA']
      ])) {
        ok(typeof event === 'object' && event !== null);
        ok('request' in event && typeof event.request === 'object' && event.request !== null);
        ok('id' in event.request);
        assertUUID(event.request.id);
        partialDeepStrictEqual(event.request, {
          name: 'example.com',
          type
        });
      }
    });

    it('Generate response event each time valid response is ready', async () => {
      const events: unknown[] = [];
      server.on('response', (event) => events.push(event));
      server.respondOnce('example.com', { A: [['192.168.0.1', 100]] });
      server.respondOnce('example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 100]] });
      await resolver.resolve4('example.com');
      await resolver.resolve6('example.com');

      equal(events.length, 2);

      for (const [event, { type, addresses }] of new Map([
        [events[0], { type: 'A', addresses: [['192.168.0.1', 100]] }],
        [events[1], { type: 'AAAA', addresses: [['2a0b:c230:35:204c::7a6', 100]] }]
      ])) {
        ok(typeof event === 'object' && event !== null);
        ok('request' in event && typeof event.request === 'object' && event.request !== null);
        ok('id' in event.request);
        assertUUID(event.request.id);
        partialDeepStrictEqual(event.request, {
          name: 'example.com',
          type
        });
        ok('response' in event && typeof event.response === 'object' && event.response !== null);
        partialDeepStrictEqual(event.response, {
          addresses,
          code: 'NOERROR'
        });
      }
    });

    it('Response event has the same request part as request event', async () => {
      const events: { request: unknown; response: unknown } = { request: {}, response: {} };
      server.on('request', (event) => (events.request = event));
      server.on('response', (event) => (events.response = event));
      server.respondOnce('example.com', { A: [['192.168.0.1', 100]] });
      await resolver.resolve4('example.com');

      ok(typeof events.request === 'object' && events.request !== null && 'request' in events.request);
      ok(typeof events.response === 'object' && events.response !== null && 'request' in events.response);
      deepStrictEqual(events.request.request, events.response.request);
    });

    it.todo('Emit error event each time request handling failed with error.');
  });
});
