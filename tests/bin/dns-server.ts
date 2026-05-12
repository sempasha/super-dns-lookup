import { env } from 'node:process';
import { DNSServer, DNSServerController } from '../lib';
import { inspect } from 'node:util';

/**
 * Configuration (environment variables) provided by {@link file://./../../docker-compose.yaml}.
 */
const {
  DNS_SERVER_FORWARD_REQUEST_FOR_HOSTS,
  DNS_SERVER_IP,
  DNS_SERVER_PORT,
  DNS_SERVER_CONTROLLER_IP,
  DNS_SERVER_CONTROLLER_PORT
} = env;

if (!DNS_SERVER_FORWARD_REQUEST_FOR_HOSTS) {
  throw new Error(
    'Environment variable DNS_SERVER_FORWARD_REQUEST_FOR_HOSTS is not specified or empty. ' +
      'Expects list of domain names which should be forwarded to system resolvers, ' +
      'e.g. registry.npmjs.com etc.'
  );
}
if (!DNS_SERVER_IP) {
  throw new Error(
    'Environment variable DNS_SERVER_IP is not specified or empty. ' +
      'Expect ip address for DNSServer incoming requests, e.g. 0.0.0.0.'
  );
}
if (!DNS_SERVER_PORT) {
  throw new Error(
    'Environment variable DNS_SERVER_PORT is not specified or empty. ' +
      'Expect port number for DNSServer incoming requests, e.g. 53.'
  );
}
if (!DNS_SERVER_CONTROLLER_IP) {
  throw new Error(
    'Environment variable DNS_SERVER_CONTROLLER_IP is not specified or empty.' +
      'Expect ip address for DNSServerController incoming requests, e.g. 0.0.0.0.'
  );
}
if (!DNS_SERVER_CONTROLLER_PORT) {
  throw new Error(
    'Environment variable DNS_SERVER_CONTROLLER_PORT is not specified or empty.' +
      'Expect port number for DNSServerController incoming requests, e.g. 80.'
  );
}

const dnsServer = new DNSServer({
  defaultResponses: DNS_SERVER_FORWARD_REQUEST_FOR_HOSTS.split(',')
    .filter(Boolean)
    .map((hostname) => ({
      respondAlways: [hostname, 'forward to node.dns']
    })),
  ip: DNS_SERVER_IP,
  port: parseInt(DNS_SERVER_PORT)
});

dnsServer.on('error', (error) =>
  log('error', {
    reporter: 'DnsServer',
    error
  })
);

dnsServer.on('request', (request) =>
  log('info', {
    reporter: 'DnsServer',
    request
  })
);

dnsServer.on('response', (response) =>
  log('info', {
    reporter: 'DnsServer',
    response
  })
);

const dnsServerController = new DNSServerController(dnsServer, {
  ip: DNS_SERVER_CONTROLLER_IP,
  port: parseInt(DNS_SERVER_CONTROLLER_PORT)
});

dnsServerController.on('error', (error) =>
  log('error', {
    reporter: 'dnsServerController',
    error
  })
);

dnsServerController.on('request', (request) =>
  log('info', {
    reporter: 'dnsServerController',
    request
  })
);

dnsServerController.on('response', (response) =>
  log('info', {
    reporter: 'dnsServerController',
    response
  })
);

process.once('error', handleError);
process.once('SIGBREAK', () => stop());
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());

void start().catch(handleError);

function log(level: 'error' | 'info', event: Record<string, unknown> | unknown) {
  const object = typeof event === 'object' && event !== null && !Array.isArray(event) ? event : { [level]: event };
  console[level](
    inspect(
      { date: new Date().toISOString(), ...object },
      {
        breakLength: Infinity,
        colors: true,
        compact: true,
        depth: Infinity,
        maxArrayLength: Infinity,
        maxStringLength: Infinity,
        showHidden: false,
        showProxy: false,
        sorted: false
      }
    )
  );
}

async function handleError(error: unknown) {
  log('error', { reporter: 'process', error });
  await stop(1);
}

async function start() {
  log('info', { reporter: 'dnsServer', state: 'starting' });
  await dnsServer.bootstrap();
  log('info', { reporter: 'dnsServer', state: 'started' });

  log('info', { reporter: 'dnsServerController', state: 'starting' });
  await dnsServerController.bootstrap();
  log('info', { reporter: 'dnsServerController', state: 'started' });
}

async function stop(exitCode?: number) {
  try {
    log('info', { reporter: 'dnsServerController', state: 'stopping' });
    await dnsServerController.teardown();
    log('info', { reporter: 'dnsServerController', state: 'stopped' });

    log('info', { reporter: 'dnsServer', state: 'stopping' });
    await dnsServer.teardown();
    log('info', { reporter: 'dnsServer', state: 'stopped' });
    process.exit(exitCode ?? 0);
  } catch (error) {
    log('error', { reporter: 'process', error });
    process.exit(exitCode ?? 1);
  }
}
