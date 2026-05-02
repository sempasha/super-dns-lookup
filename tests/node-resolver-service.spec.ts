import { deepEqual, equal } from 'node:assert';
import dns from 'node:dns/promises';
import { afterEach, describe, it, mock } from 'node:test';
import { NodeResolverService } from '../';
import { dnsServer } from './util';

describe('NodeResolverService', () => {
  afterEach(async () => {
    mock.restoreAll();
    await dnsServer.reset();
  });

  describe('#resolve4', () => {
    it('Resolves hostname to an IPv4 addresses using NodeJS built-in dns.resolve4.', async () => {
      const resolve4 = mock.method(dns, 'resolve4');
      await dnsServer.respondOnce('example.com', { A: [['192.168.0.1', 3600]] });
      const resolver = new NodeResolverService();
      await resolver.resolve4('example.com');
      equal(resolve4.mock.calls.length, 1);
      deepEqual(resolve4.mock.calls[0]!.arguments, ['example.com', { ttl: true }]);
    });

    it('Provides the IP address and A record TTL for each found record.', async () => {
      await dnsServer.respondOnce('example.com', { A: [['192.168.0.1', 3600]] });
      const resolver = new NodeResolverService();
      deepEqual(await resolver.resolve4('example.com'), [{ address: '192.168.0.1', ttl: 3600 }]);
    });
  });

  describe('#resolve6', () => {
    it('Resolves hostname to an IPv6 addresses using NodeJS built-in dns.resolve6.', async () => {
      const resolve6 = mock.method(dns, 'resolve6');
      await dnsServer.respondOnce('example.com', { AAAA: [['2345:425:2ca1::567:5673:23b5', 3600]] });
      const resolver = new NodeResolverService();
      await resolver.resolve6('example.com');
      equal(resolve6.mock.calls.length, 1);
      deepEqual(resolve6.mock.calls[0]!.arguments, ['example.com', { ttl: true }]);
    });

    it('Provides the IP address and AAAA record TTL for each found record.', async () => {
      await dnsServer.respondOnce('example.com', { AAAA: [['2345:425:2ca1::567:5673:23b5', 3600]] });
      const resolver = new NodeResolverService();
      deepEqual(await resolver.resolve6('example.com'), [{ address: '2345:425:2ca1::567:5673:23b5', ttl: 3600 }]);
    });
  });
});
