# ⚡ dns.lookup with no threads pool

## 💡 Motivation

NodeJS builtin [dns][docs-dns] module has [dns.lookup][docs-dns-lookup] function to resolve domain names into ip addresses.
It is used as default address resolution method in most NodeJS builtin network related modules:

- when you make HTTP request with [http.request][docs-http-request];
- or establish new connection with [Socket#connect][docs-net-socket-connect];
- or send data over UDP with [dgram.Socket#send][docs-dgram-socket-send].

While [dns.lookup][docs-dns-lookup] seems to be asynchronous and non blocking function,
according to [implementation considerations][docs-dns-lookup-implementation] it uses synchronous
[docs-getaddrinfo][docs-getaddrinfo] function and the latter called via threads pool.
By default threads pool has size of 4 threads, and it may be a bottleneck:

- when your DNS server becomes slow for some reason, e.g. heavy load or an authoritative server(s) issues;
- or threads pool occupied by tasks like asynchronous filesystem io, asynchronous zlib calls or some crypto module's methods.

Please, consider reeading of [Don't Block the Event Loop (or the Worker Pool)][docs-block-working-pool].

💡 The idea of this library is implement [dns.lookup][docs-dns-lookup] compatible function
which does not reply on threads pool, and it is based on [dns.resolve4][docs-dns-resolve4]/[dns.resolve6][docs-dns-resolve6] functions family.
It is exactly what NodeJS documentations recommends to do.

Each time you make http.request, create tcp socket or event datagram socket, you may use this function as lookup option:

```ts
import { request } from 'node:http';
import { lookup } from '@sempasha/dns.lookup';

const req = request('https://example.com', { lookup }, (res) => {
  /* handle response */
});
req.end();
```

```ts
import { Socket } from 'node:net';
import { lookup } from '@sempasha/dns.lookup';

const socket = new Socket();
socket.connect('example.com', { lookup }, () => {
  socket.write('hello world');
  socket.end();
});
```

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
* **Built-in cache** - ability to use built-in cache, usually in memory cache;
* **Cache size** - ability to limit cache size. May require cache provider to support listing with paging;
* **Cache TTL** - ability to set TTL on cache records, based on A/AAAA records TTL. May require cache provider to support expiration method or ttl option of set method;
* **Cache lock** - ability to limit number of simultaneous queries for same host name to single query, and wait until current query response instead of firing new query;
* **Cache lock timeout** - ability to limit the time of waiting that current resolve query to be completed, before firing new query;
* **Cache round robin** - ability to store all IP addresses for given host name in cache, and reply with next IP in list on each next request of resolving same host name into single IP address;
* **Expired cache fallback** - ability to use expired cache as fallback when query ends up with error;
* **Cache failures** - ability to avoid query flood by caching `ENOTFOUND` and `ENODATA` response for some time;
* **Circuit breaker** - ability to avoid query flood by limiting communication with resolver for some time after `SERVFAIL` and `REFUSED` errors  or query timeout. May be based on caching failed query result for some time;
* **Installment API** - ability to install lookup function on [HTTP Agent](https://nodejs.org/api/http.html#class-httpagent) or even more.

## 📦 Alternatives

There are at least three alternatives:

* [better-lookup][package-better-lookup];
* [dns-lookup-cache][package-dns-lookup-cache];
* [cacheable-lookup][package-cacheable-lookup].

| Feature | ⚡ node-dns-lookup | [better-lookup][package-better-lookup] | [dns-lookup-cache][package-dns-lookup-cache] | [cacheable-lookup][package-cacheable-lookup] |
|:--|:--|:--|:--|:--|
| **[dns.lookup][docs-dns-lookup] compatible** | ❔ | ✅ | ❎ [^1] | ❎ [^2] |
| **IP recognition** | ❔ | ✅ | ❌ | ❌ |
| **[/etc/hosts][docs-etc-hosts] file** | ❔ | ✅ | ❌ | ❌ |
| **Configurable resolver** | ❔ | ❌ | ❌ | ✅ |
| **Built-in resolver without [docs-getaddrinfo][docs-getaddrinfo]** | ❔ | ✅ | ✅ | ❎ [^3] |
| **Configurable cache** | ❔ | ❌ | ❌ | ❎ [^4] |
| **Built-in cache** | ❔ | ✅ | ✅ | ✅ |
| **Cache size** | ❔ | ❌ | ❌ | ❌ |
| **Cache TTL** | ❔ | ❎ [^5] | ✅ | ✅ |
| **Cache lock** | ❔ | ✅ | ❌ | ❌ |
| **Cache lock timeout** | ❔ | ❌ | ❌ | ❌ |
| **Cache round robin** | ❔ | ✅ | ✅ | ❌ |
| **Expired cache fallback** | ❔ | ❌ | ❌ | ❌ |
| **Cache failures** | ❔ | ❌ | ❌ | ✅ |
| **Circuit breaker** | ❔ | ❌ | ❌ | ❌ |
| **Installment API** | ❔ | ✅ | ❌ | ✅ |

[^1]: [dns-lookup-cache][package-dns-lookup-cache] supports only family (number 0, 4 or 6) and all (boolean) options.
[^2]: [cacheable-lookup][package-cacheable-lookup] supports only family (number 0, 4 or 6), all (boolean),  options and hints ([flags][docs-dns-flags]) options.
[^3]: [cacheable-lookup][package-cacheable-lookup] supports only synchronous cache like [Map][docs-ecma-map].
[^4]: [cacheable-lookup][package-cacheable-lookup] requires configured Resolver, otherwise it falls back to [dns.lookup][docs-dns-lookup].
[^5]: [better-lookup][package-better-lookup] enforces max TTL of 10 seconds.

<!--- links -->

[docs-block-working-pool]: https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop#what-code-runs-on-the-worker-pool '🐢 NodeJS blog: Don\'t Block the Event Loop (or the Worker Pool)'
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
