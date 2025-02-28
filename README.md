# ⚡ fast and reliable dns.lookup

## 💡 Motivation

NodeJS built-in [dns][docs-dns] module has [dns.lookup][docs-dns-lookup] function to resolve domain names into ip addresses.
This built-in function appears to be default address resolution method for most network related modules of NodeJS.
It implicitly used every time:

- you make HTTP(S) request with [http.request][docs-http-request];
- or establish new connection with [Socket#connect][docs-net-socket-connect];
- or send data over UDP with [dgram.Socket#send][docs-dgram-socket-send].

Function [dns.lookup][docs-dns-lookup] seems to be asynchronous and non blocking.
But according to [implementation considerations][docs-dns-lookup-implementation],
[dns.lookup][docs-dns-lookup] calls synchronous [getaddrinfo][docs-getaddrinfo],
which performs via worker threads pool and defaylt pool size is 4 threads.

Threads pool turns in bottleneck when becomes busy by:

- slow DNS queries, e.g. when a DNS server is overloaded or an authoritative server issues;
- slow crypto, fs or zlib calls.

Please, consider reading of [Don't Block the Event Loop (or the Worker Pool)][docs-block-working-pool].

💡 The idea of this library is implement [dns.lookup][docs-dns-lookup] compatible function
which does not reply on threads pool, and it is based on [dns.resolve4][docs-dns-resolve4] and
[dns.resolve6][docs-dns-resolve6] functions. It is exactly what NodeJS documentation recommends to do.

New lookup function should be used to:

* Create new tcp connection while performing [http.request][docs-http-request]:
  ```ts
  import { request } from 'node:http';
  import { lookup } from '@sempasha/dns.lookup';

  const req = request('https://example.com', { lookup }, (res) => {
    /* handle response */
  });
  req.end();
  ```
* Connect tcp socket via [net.Socket#connect][docs-net-socket-connect]:
  ```ts
  import { Socket } from 'node:net';
  import { lookup } from '@sempasha/dns.lookup';
  
  const socket = new Socket();
  socket.connect('example.com', { lookup }, () => {
    socket.write('hello world');
    socket.end();
  });
  ```
* Create new datagram socket via [dgram.createSocket][docs-dgram-create-socket]
  for sending some data via [dgram.Socket#send][docs-dgram-socket-send]:
  ```ts
  import { createSocket } from 'node:udp';
  import { lookup } from '@sempasha/dns.lookup';
  
  const socket = createSocket({ lookup });
  socket.send('hello world', () => {
    socket.close();
  });
  ```

## 📋 Features

* **[dns.lookup][docs-dns-lookup] compatible** - module provides function fully compatible with NodeJS's builtin [dns.lookup][docs-dns-lookup];
* **IP recognition** - recognize when host name is IP address and resolve it immediately without querying resolver;
* **[/etc/hosts][docs-etc-hosts] file** - ability to resolve host name based on [/etc/hosts][docs-etc-hosts];
* **Configurable resolver** - ability to set resolver service with interface like [resolve4][docs-dns-resolve4]/[resolve6][docs-dns-resolve6];
* **Built-in resolver without [docs-getaddrinfo][docs-getaddrinfo]** - ability to use builtin resolver which do not relay on [dns.lookup][docs-dns-lookup] and [docs-getaddrinfo][docs-getaddrinfo];
* **Configurable cache** - ability to provide cache service with interface like set, get, list and delete;
* **Persistent cache** - ability to export cache into storage (file or service);
* **Built-in cache** - ability to use built-in cache, usually in memory cache;
* **Cache size** - ability to limit cache size. May require cache provider to support listing with paging;
* **Cache TTL** - ability to set TTL on cache records, based on A/AAAA records TTL. May require cache provider to support expiration method or ttl option of set method;
* **Cache lock** - ability to limit number of simultaneous queries for same host name to single query, and wait until current query response instead of firing new query;
* **Cache lock timeout** - ability to limit the time of waiting that current resolve query to be completed, before firing new query;
* **Cache round robin** - ability to store all IP addresses for given host name in cache, and reply with next IP in list on each next request of resolving same host name into single IP address;
* **Expired cache fallback** - ability to use expired cache as fallback when query ends up with error;
* **Cache failures** - ability to avoid query flood by caching `ENOTFOUND` and `ENODATA` response for some time;
* **Circuit breaker** - ability to avoid query flood by limiting communication with resolver for some time after `SERVFAIL` and `REFUSED` errors  or query timeout. May be based on caching failed query result for some time;
* **Installment API** - ability to install lookup function on [HTTP Agent](https://nodejs.org/api/http.html#class-httpagent) or even more;
**Exports CommonJS, ESM, TypeScript** - ability to use CommonJS and ESM exports of package or TypeScript declarations.

## 📦 Alternatives

There are at least three alternatives:

* [better-lookup][package-better-lookup];
* [dns-lookup-cache][package-dns-lookup-cache];
* [cacheable-lookup][package-cacheable-lookup].

| Feature | ⚡ node-dns-lookup | [better-lookup][package-better-lookup] | [cacheable-lookup][package-cacheable-lookup] | [dns-lookup-cache][package-dns-lookup-cache] |
|:--|:--|:--|:--|:--|
| **dns.lookup compatible**                 | ❔ | ✅      | ❎ [^1] | ❎ [^2] |
| **IP recognition**                        | ❔ | ✅      | ❌      | ❌      |
| **docs-etc-hosts file**                   | ❔ | ✅      | ❌      | ❌      |
| **Configurable resolver**                 | ❔ | ❌      | ✅      | ❌      |
| **Built-in resolver without getaddrinfo** | ❔ | ✅      | ❎ [^3] | ✅      |
| **Configurable cache**                    | ❔ | ❌      | ✅      | ❌      |
| **Persistent cache**                      | ❔ | ❌      | ✅      | ❌      |
| **Built-in cache**                        | ❔ | ✅      | ✅      | ✅      |
| **Cache size**                            | ❔ | ❌      | ❌      | ❌      |
| **Cache TTL**                             | ❔ | ❎ [^4] | ✅      | ✅      |
| **Cache lock**                            | ❔ | ✅      | ❌      | ❌      |
| **Cache lock timeout**                    | ❔ | ❌      | ❌      | ❌      |
| **Cache round robin**                     | ❔ | ✅      | ❌      | ✅      |
| **Expired cache fallback**                | ❔ | ❌      | ❌      | ❌      |
| **Cache failures**                        | ❔ | ❌      | ❌      | ❌      |
| **Circuit breaker**                       | ❔ | ❌      | ❌      | ❌      |
| **Installment API**                       | ❔ | ✅      | ✅      | ❌      |
| **Exports CommonJS**                      | ❔ | ✅      | ❌      | ✅      |
| **Exports ESM**                           | ❔ | ✅      | ✅      | ❌      |
| **Exports TypeScript**                    | ❔ | ✅      | ✅      | ❌      |

[^1]: [cacheable-lookup][package-cacheable-lookup] supports only family (number 0, 4 or 6), all (boolean), options and hints ([flags][docs-dns-flags]) options.
[^2]: [dns-lookup-cache][package-dns-lookup-cache] supports only family (number 0, 4 or 6) and all (boolean) options.
[^3]: [cacheable-lookup][package-cacheable-lookup] by default have fallback to [dns.lookup][docs-dns-lookup].
[^4]: [better-lookup][package-better-lookup] enforces max TTL of 10 seconds.

| Statistics | ⚡ node-dns-lookup | [better-lookup][package-better-lookup] | [cacheable-lookup][package-cacheable-lookup] | [dns-lookup-cache][package-dns-lookup-cache] |
|:--|:--|:--|:--|:--|
| **Downloads per month** | ![❔](https://img.shields.io/npm/dm/node-dns-lookup) | ![❔](https://img.shields.io/npm/dm/better-lookup) | ![❔](https://img.shields.io/npm/dm/cacheable-lookup) | ![❔](https://img.shields.io/npm/dm/dns-lookup-cache) |
| **Stars**               | ![❔](https://img.shields.io/github/stars/sempasha/node-dns-lookup) | ![❔](https://img.shields.io/github/stars/ayonli/better-lookup) | ![❔](https://img.shields.io/github/stars/szmarczak/cacheable-lookup) | ![❔](https://img.shields.io/github/stars/LCMApps/dns-lookup-cache) |
| **Issues**              | ![❔](https://img.shields.io/github/issues/sempasha/node-dns-lookup) | ![❔](https://img.shields.io/github/issues/ayonli/better-lookup) | ![❔](https://img.shields.io/github/issues/szmarczak/cacheable-lookup) | ![❔](https://img.shields.io/github/issues/LCMApps/dns-lookup-cache) |
| **Pull requests**       | ![❔](https://img.shields.io/github/issues-pr/sempasha/node-dns-lookup) | ![❔](https://img.shields.io/github/issues-pr/ayonli/better-lookup) | ![❔](https://img.shields.io/github/issues-pr/szmarczak/cacheable-lookup) | ![❔](https://img.shields.io/github/issues-pr/LCMApps/dns-lookup-cache) |

<!--- links -->

[docs-block-working-pool]: https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop#what-code-runs-on-the-worker-pool '🐢 NodeJS blog: Don\'t Block the Event Loop (or the Worker Pool)'
[docs-dgram-create-socket]: https://nodejs.org/api/dgram.html#dgramcreatesocketoptions-callback '🐢 NodeJS dgram.createSocket'
[docs-dgram-socket-send]: https://nodejs.org/api/dgram.html#socketsendmsg-offset-length-port-address-callback '🐢 NodeJS dgram.Socket#send'
[docs-dns]: https://nodejs.org/api/dns.html '🐢 NodeJS dns module'
[docs-dns-flags]: (https://nodejs.org/api/dns.html#supported-getaddrinfo-flags) '🐢 NodeJS getaddrinfo flags'
[docs-dns-lookup]: https://nodejs.org/api/dns.html#dnslookuphostname-options-callback '🐢 NodeJS dns.lookup'
[docs-dns-lookup-implementation]: https://nodejs.org/api/dns.html#dnslookup '🐢 NodeJS dns.lookup implementation considerations'
[docs-dns-resolve4]: https://nodejs.org/api/dns.html#dnsresolve4hostname-options-callback '🐢 NodeJS dns.resolve4'
[docs-dns-resolve6]: https://nodejs.org/api/dns.html#dnsresolve6hostname-options-callback '🐢 NodeJS dns.resolve6'
[docs-ecma-map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map '📖 Map'
[docs-etc-hosts]: https://www.man7.org/linux/man-pages/man5/hosts.5.html '🐧 Linux manual page — /etc/hosts(5)'
[docs-getaddrinfo]: https://www.man7.org/linux/man-pages/man3/getaddrinfo.3.html '🐧 Linux manual page — getaddrinfo(3)'
[docs-http-request]: https://nodejs.org/api/http.html#httprequestoptions-callback '🐢 NodeJS http.requsst'
[docs-net-socket-connect]: https://nodejs.org/api/net.html#socketconnectoptions-connectlistener '🐢 NodeJS net.Socket#connect'
[package-better-lookup]: https://github.com/ayonli/better-lookup '📦 better-lookup library'
[package-cacheable-lookup]: https://github.com/szmarczak/cacheable-lookup '📦 cacheable-lookup library'
[package-dns-lookup-cache]: https://github.com/LCMApps/dns-lookup-cache '📦 dns-lookup-cache library'
