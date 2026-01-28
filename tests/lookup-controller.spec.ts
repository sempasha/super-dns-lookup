import { doesNotReject } from 'node:assert';
import { env } from 'node:process';
import { lookup } from 'node:dns/promises';
import { describe, it } from 'node:test';
import { DNSServerControllerClient } from './util';

describe.only('LookupController', () => {
  describe('node:dns.lookup compatibility', () => {
    const dnsServer = new DNSServerControllerClient({
      ip: env.DNS_SERVER_CONTROLLER_IP!,
      port: parseInt(env.DNS_SERVER_CONTROLLER_PORT!)
    });

    it('DNSServer is responsible and ready for tests', async () => {
      await doesNotReject(dnsServer.reset());
    });
  });
});
