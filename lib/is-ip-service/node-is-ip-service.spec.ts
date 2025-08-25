import { isIPv4, isIPv6 } from 'node:net';
import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';
import { NodeIsIpService } from './node-is-ip-service';

describe('NodeIsIpService', () => {
  const ipv4 = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '203.0.113.1'];
  const ipv6 = [
    '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    '2001:db8::1',
    '::1',
    '2001:0db8:0001:0000:0000:0000:0000:0001'
  ];
  const notIp = ['not an ip address', 'not an ip v4 address', 'not an ip v6 address', 'example.com is a hostname'];

  describe('#isIPv4', () => {
    it('Tells whether provided string is IPv4 address or not.', () => {
      const service = new NodeIsIpService();
      for (const address of ipv4) {
        strictEqual(service.isIPv4(address), true);
      }
      for (const address of [...ipv6, ...notIp]) {
        strictEqual(service.isIPv4(address), false);
      }
    });

    it("Behaves the same way NodeJS's net.isIPv4", () => {
      const service = new NodeIsIpService();
      for (const address of [...ipv4, ...ipv6, ...notIp]) {
        strictEqual(service.isIPv4(address), isIPv4(address));
      }
      strictEqual(service.isIPv4, isIPv4);
    });
  });

  describe('#isIPv6', () => {
    it('Tells whether provided string is IPv6 address or not.', () => {
      const service = new NodeIsIpService();
      for (const address of ipv6) {
        strictEqual(service.isIPv6(address), true);
      }
      for (const address of [...ipv4, ...notIp]) {
        strictEqual(service.isIPv6(address), false);
      }
    });

    it("Behaves the same way NodeJS's net.isIPv6", () => {
      const service = new NodeIsIpService();
      for (const address of [...ipv4, ...ipv6, ...notIp]) {
        strictEqual(service.isIPv6(address), isIPv6(address));
      }
      strictEqual(service.isIPv4, isIPv4);
    });
  });
});
