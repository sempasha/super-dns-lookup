import { deepEqual, equal, ok, rejects } from 'node:assert';
import { createSocket } from 'node:dgram';
import { Resolver } from 'node:dns/promises';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { encode } from 'dns-packet';
import { toRcode } from 'dns-packet/rcodes';
import { DNSServer } from './dns-server';

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
      deepEqual(calls[0]!.arguments, [Infinity, 'example.com', 'ESERVFAIL']);
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
      deepEqual(calls[0]!.arguments, [1, 'example.com', 'ESERVFAIL']);
    });
  });

  describe('~handleRequest (how server handle requests)', () => {
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
        const error = await new Promise((resolve) => {
          server.once('error', resolve);
        });
        ok(error instanceof Error);
        equal(error.message, 'DNSServer expects only "query" packets, got "response"');
      } finally {
        socket.close();
      }
    });

    it('Supports only queries with at least one question in it.', async () => {
      const socket = createSocket('udp4');
      try {
        socket.send(encode({ type: 'query', questions: [] }), 1053, '127.0.0.1');
        const error = await new Promise((resolve) => {
          server.once('error', resolve);
        });
        ok(error instanceof Error);
        equal(error.message, 'DNSServer expects question in query, got nothing');
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
        const error = await new Promise((resolve) => {
          server.once('error', resolve);
        });
        ok(error instanceof Error);
        equal(error.message, 'DNSServer expects only one question in query, got 2');
      } finally {
        socket.close();
      }
    });

    it('Supports only questions about "IN" record classes.', async () => {
      const socket = createSocket('udp4');
      try {
        const questions = [{ name: 'example.com', type: 'A' as const, class: 'ANY' as const }];
        socket.send(encode({ type: 'query', questions }), 1053, '127.0.0.1');
        const error = await new Promise((resolve) => {
          server.once('error', resolve);
        });
        ok(error instanceof Error);
        equal(error.message, 'DNSServer supports only questions of class "IN", got "ANY"');
      } finally {
        socket.close();
      }
    });

    it('Supports only questions about "A"/"AAAA" record types.', { timeout: 10000 }, async () => {
      const start = Date.now();

      let error: Error | undefined;
      server.on('error', (e) => (error = e));

      for (const suffix of ['4', '6'] as const) {
        await rejects(resolver[`resolve${suffix}`]('example.com'));
        equal(error, undefined);
      }

      for (const suffix of ['Any', 'Caa', 'Cname', 'Mx', 'Naptr', 'Ns', 'Ptr', 'Soa', 'Srv', 'Tlsa', 'Txt'] as const) {
        await rejects(resolver[`resolve${suffix}`]('example.com'));
        equal(error?.message, `DNSServer supports only questions of type "A" or "AAAA", got "${suffix.toUpperCase()}"`);
      }
    });

    it('When answer has been configured by DNSServer#respondAlways, always returns configured answer.', async () => {
      server.respondAlways('example.com', { A: [['192.168.0.1', 40]], AAAA: [['2a0b:c230:35:204c::7a6', 60]] });
      for (let i = 0; i < 9999; i++) {
        deepEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
        deepEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      }
    });

    it('When answer has been configured by DNSServer#respondOnce, returns configured answer only once.', async () => {
      server.respondOnce('example.com', { A: [['192.168.0.1', 40]] });
      deepEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
      await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });

      server.respondOnce('example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 60]] });
      deepEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      await rejects(resolver.resolve6('example.com'), { message: 'queryAaaa ENOTFOUND example.com' });
    });

    it('When answer has been configured by DNSServer#respondTimes, returns configured answer as many times as said.', async () => {
      server.respondTimes(2, 'example.com', { A: [['192.168.0.1', 40]] });
      deepEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
      deepEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);
      await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });

      server.respondTimes(2, 'example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 60]] });
      deepEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      deepEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);
      await rejects(resolver.resolve6('example.com'), { message: 'queryAaaa ENOTFOUND example.com' });
    });

    it('When no answer configured by calling DNSServer#respondAlways/DNSServer#respondOnce/DNSServer#respondTimes, returns NX answer.', async () => {
      await rejects(resolver.resolve4('example.com'), { message: 'queryA ENOTFOUND example.com' });
      await rejects(resolver.resolve6('example.com'), { message: 'queryAaaa ENOTFOUND example.com' });
    });

    it('Allows DNSServerError to be configured as answer by calling DNSServer#respondAlways/DNSServer#respondOnce/DNSServer#respondTimes methods.', async () => {
      server.respondAlways('always.example.com', { A: [['192.168.0.1', 100]] });
      for (let i = 0; i < 99; i++) {
        deepEqual(await resolver.resolve4('always.example.com'), ['192.168.0.1']);
      }

      server.respondOnce('once.example.com', { A: [['192.168.0.1', 100]] });
      deepEqual(await resolver.resolve4('once.example.com'), ['192.168.0.1']);
      await rejects(resolver.resolve4('once.example.com'), { message: 'queryA ENOTFOUND once.example.com' });

      server.respondTimes(3, 'times.example.com', { A: [['192.168.0.1', 100]] });
      deepEqual(await resolver.resolve4('times.example.com'), ['192.168.0.1']);
      deepEqual(await resolver.resolve4('times.example.com'), ['192.168.0.1']);
      deepEqual(await resolver.resolve4('times.example.com'), ['192.168.0.1']);
      await rejects(resolver.resolve4('times.example.com'), { message: 'queryA ENOTFOUND times.example.com' });
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
      server.respondOnce('example.com', { A: [['192.168.0.1', 100]] });
      deepEqual(await resolver.resolve4('example.com'), ['192.168.0.1']);

      server.respondOnce('example.com', { A: [['192.168.0.1', 100]] });
      deepEqual(await resolver.resolve4('example.com', { ttl: true }), [{ address: '192.168.0.1', ttl: 100 }]);
    });

    it('When answer has been configured as AAAA records, then returns them.', async () => {
      server.respondOnce('example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 100]] });
      deepEqual(await resolver.resolve6('example.com'), ['2a0b:c230:35:204c::7a6']);

      server.respondOnce('example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 100]] });
      deepEqual(await resolver.resolve6('example.com', { ttl: true }), [
        { address: '2a0b:c230:35:204c::7a6', ttl: 100 }
      ]);
    });
  });
});
