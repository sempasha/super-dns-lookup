import { deepEqual, equal, partialDeepStrictEqual, rejects } from 'node:assert';
import { after, afterEach, before, describe, it, mock } from 'node:test';
import { DNSServerController, DNSServerControllerClient } from './dns-server-controller';
import { DNSServer } from './dns-server';

describe('DNSServerController and DNSServerControllerClient (used only for tests)', () => {
  const dnsServer = new DNSServer({ ip: '127.0.0.1', port: 1053 });
  const dnsServerController = new DNSServerController(dnsServer, { ip: '127.0.0.1', port: 1080 });
  const dnsServerControllerClient = new DNSServerControllerClient({ ip: '127.0.0.1', port: 1080 });

  before(async () => {
    await dnsServer.bootstrap();
    await dnsServerController.bootstrap();
  });

  after(async () => {
    await dnsServer.teardown();
    await dnsServerController.teardown();
  });

  afterEach(() => {
    mock.reset();
    dnsServer.reset();
  });

  describe('DNSServerControllerClient', () => {
    describe('#reset', () => {
      it('Calls DNSServer#reset via DNSServerController.', async () => {
        const reset = mock.method(dnsServer, 'reset');
        await dnsServerControllerClient.reset();
        const calls = reset.mock.calls;
        equal(calls.length, 1);
        deepEqual(calls[0]!.arguments, []);
      });
    });

    describe('#respondAlways', () => {
      it('Calls DNSServer#respondAlways via DNSServerController.', async () => {
        const respondAlways = mock.method(dnsServer, 'respondAlways');
        await dnsServerControllerClient.respondAlways('example.com', { A: [['192.168.0.1', 600]] });
        const calls = respondAlways.mock.calls;
        equal(calls.length, 1);
        deepEqual(calls[0]!.arguments, ['example.com', { A: [['192.168.0.1', 600]] }]);
      });
    });

    describe('#respondOnce', () => {
      it('Calls DNSServer#respondOnce via DNSServerController.', async () => {
        const respondOnce = mock.method(dnsServer, 'respondOnce');
        await dnsServerControllerClient.respondOnce('example.com', { A: [['192.168.0.1', 600]] });
        const calls = respondOnce.mock.calls;
        equal(calls.length, 1);
        deepEqual(calls[0]!.arguments, ['example.com', { A: [['192.168.0.1', 600]] }]);
      });
    });

    describe('#respondTimes', () => {
      it('Calls DNSServer#respondTimes via DNSServerController.', async () => {
        const respondTimes = mock.method(dnsServer, 'respondTimes');
        await dnsServerControllerClient.respondTimes(2, 'example.com', { A: [['192.168.0.1', 600]] });
        const calls = respondTimes.mock.calls;
        equal(calls.length, 1);
        deepEqual(calls[0]!.arguments, [2, 'example.com', { A: [['192.168.0.1', 600]] }]);
      });
    });
  });

  describe('DNSServerController', () => {
    describe('#bootstrap', () => {
      it('Starts listening the specified TCP ip:port to capture HTTP control requests.', async () => {
        const dnsServerControllerClient = new DNSServerControllerClient({ ip: '127.0.0.1', port: 8888 });
        const dnsServerController = new DNSServerController(dnsServer, { ip: '0.0.0.0', port: 8888 });
        const reset = mock.method(dnsServer, 'reset');
        const respondAlways = mock.method(dnsServer, 'respondAlways');
        const respondOnce = mock.method(dnsServer, 'respondOnce');
        const respondTimes = mock.method(dnsServer, 'respondTimes');
        reset.mock.mockImplementation(() => undefined);
        respondAlways.mock.mockImplementation(() => undefined);
        respondOnce.mock.mockImplementation(() => undefined);
        respondTimes.mock.mockImplementation(() => undefined);
        try {
          await dnsServerController.bootstrap();
          await dnsServerControllerClient.respondAlways('always.example.com', { A: [['192.168.0.1', 100]] });
          await dnsServerControllerClient.respondOnce('once.example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 100]] });
          await dnsServerControllerClient.respondTimes(2, 'times.example.com', {
            A: [['192.168.0.2', 100]],
            AAAA: [['2a0b:c230:35:204c::7a8', 100]]
          });
          await dnsServerControllerClient.reset();
          equal(reset.mock.callCount(), 1);
          partialDeepStrictEqual(reset.mock.calls[0], { arguments: [] });
          equal(respondAlways.mock.callCount(), 1);
          partialDeepStrictEqual(respondAlways.mock.calls[0], {
            arguments: ['always.example.com', { A: [['192.168.0.1', 100]] }]
          });
          equal(respondOnce.mock.callCount(), 1);
          partialDeepStrictEqual(respondOnce.mock.calls[0], {
            arguments: ['once.example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 100]] }]
          });
          equal(respondTimes.mock.callCount(), 1);
          partialDeepStrictEqual(respondTimes.mock.calls[0], {
            arguments: [2, 'times.example.com', { A: [['192.168.0.2', 100]], AAAA: [['2a0b:c230:35:204c::7a8', 100]] }]
          });
        } finally {
          await dnsServerController.teardown();
        }
      });
    });

    describe('#teardown', () => {
      it('Stops listening the specified TCP ip:port, no more HTTP requests will be handled after teardown has been called.', async () => {
        const dnsServerControllerClient = new DNSServerControllerClient({ ip: '127.0.0.1', port: 8888 });
        const dnsServerController = new DNSServerController(dnsServer, { ip: '0.0.0.0', port: 8888 });
        const reset = mock.method(dnsServer, 'reset');
        const respondAlways = mock.method(dnsServer, 'respondAlways');
        const respondOnce = mock.method(dnsServer, 'respondOnce');
        const respondTimes = mock.method(dnsServer, 'respondTimes');
        reset.mock.mockImplementation(() => undefined);
        respondAlways.mock.mockImplementation(() => undefined);
        respondOnce.mock.mockImplementation(() => undefined);
        respondTimes.mock.mockImplementation(() => undefined);
        await dnsServerController.bootstrap();
        await dnsServerController.teardown();
        await rejects(dnsServerControllerClient.respondAlways('always.example.com', { A: [['192.168.0.1', 100]] }), {
          code: 'ECONNREFUSED'
        });
        await rejects(
          dnsServerControllerClient.respondOnce('once.example.com', { AAAA: [['2a0b:c230:35:204c::7a6', 100]] }),
          { code: 'ECONNREFUSED' }
        );
        await rejects(
          dnsServerControllerClient.respondTimes(2, 'times.example.com', {
            A: [['192.168.0.2', 100]],
            AAAA: [['2a0b:c230:35:204c::7a8', 100]]
          }),
          { code: 'ECONNREFUSED' }
        );
        await rejects(dnsServerControllerClient.reset(), { code: 'ECONNREFUSED' });
        equal(reset.mock.callCount(), 0);
        equal(respondAlways.mock.callCount(), 0);
        equal(respondOnce.mock.callCount(), 0);
        equal(respondTimes.mock.callCount(), 0);
      });
    });

    describe('~handleRequest', () => {
      it.todo('Handles HTTP control request and apply them to DNSServer.');
      it.todo('Rejects non POST requests with 405 status code.');
      it.todo('Rejects non JSON requests with 406 status code.');
      it.todo('Rejects any request which has no "method" and "parameters" properties in body.');
      it.todo(
        'Accept request with method of "reset" and empty parameters array DNSServer#reset replying with 200 status code.'
      );
      it.todo('Calls DNSServer#reset every time reset method requested.');
      it.todo(
        'Accept request with method of "respondAlways" tuple of hostname and DNSResponse parameters replying with 200 status code.'
      );
      it.todo('Calls DNSServer#respondAlways with specified parameters every time respondAlways method requested.');
      it.todo(
        'Accept request with method of "respondOnce" tuple of hostname and DNSResponse parameters replying with 200 status code.'
      );
      it.todo('Calls DNSServer#respondOnce with specified parameters every time respondOnce method requested.');
      it.todo(
        'Accept request with method of "respondTimes" tuple of number of times, hostname and DNSResponse parameters replying with 200 status code.'
      );
      it.todo('Calls DNSServer#respondTimes with specified parameters every time respondTimes method requested.');
    });
  });
});
