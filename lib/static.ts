import { SuperLookupController } from './lookup-controller';

const controller = new SuperLookupController({
  lazyBootstrap: true,
  lazyTeardown: ['SIGHUP', 'SIGINT', 'SIGTERM']
});

/**
 * Statically available {@link SuperLookupController#lookup} method.
 *
 * @example
 * import { lookup } from 'super-dns-lookup';
 * lookup('example.com', console.log);
 */
export const lookup = controller.lookup;

/**
 * Statically available {@link SuperLookupController#install} method.
 *
 * @example
 * import { Agent } from 'node:http';
 * import { install } from 'super-dns-lookup';
 * const agent = new Agent();
 * install(agent);
 */
export const install = controller.install.bind(controller);
