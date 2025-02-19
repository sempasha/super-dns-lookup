# ⚡ dns.lookup with no threads pool

NodeJS builtin [dns][node-dns] module has [dns.lookup][node-dns-lookup] function to resolve domain names into ip addresses.
It is used as default address resolution method in most NodeJS builtin network related modules:

- when you make HTTP request with [http.request][node-http-request];
- or establish new connection with [Socket#connect][node-net-socket-connect];
- or send data over UDP with [dgram.Socket#send][node-dgram-socket-send].

While [dns.lookup][node-dns-lookup] seems to be asynchronous and non blocking function,
according to [implementation considerations][node-dns-lookup-implementation] it uses synchronous
[getaddrinfo][getaddrinfo] function and the latter called via threads pool.
By default threads pool has size of 4 threads, and it may be a bottleneck:

- when your DNS server becomes slow for some reason, e.g. heavy load or an authoritative server(s) issues;
- or threads pool occupied by tasks like asynchronous filesystem io, asynchronous zlib calls or some crypto module's methods.

Please, consider reeading of [Don't Block the Event Loop (or the Worker Pool)][node-blog-working-pool].

💡 The idea of this library is implement [dns.lookup][node-dns-lookup] compatible function
which does not reply on threads pool, and it is based on [dns.resolve][node-dns-resolve] functions family.
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

<!--- links -->
[getaddrinfo]: https://www.man7.org/linux/man-pages/man3/getaddrinfo.3.html '🐧 Linux manual page — getaddrinfo(3)'
[node-blog-working-pool]: https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop#what-code-runs-on-the-worker-pool '🐢 NodeJS blog: Don\'t Block the Event Loop (or the Worker Pool)'
[node-dgram-socket-send]: https://nodejs.org/docs/latest/api/dgram.html#socketsendmsg-offset-length-port-address-callback '🐢 NodeJS dgram.Socket#send'
[node-dns]: https://nodejs.org/docs/latest/api/dns.html '🐢 NodeJS dns module'
[node-dns-lookup]: https://nodejs.org/docs/latest/api/dns.html#dnslookuphostname-options-callback '🐢 NodeJS dns.lookup'
[node-dns-lookup-implementation]: https://nodejs.org/docs/latest/api/dns.html#dnslookup '🐢 NodeJS dns.lookup implementation considerations'
[node-dns-resolve]: https://nodejs.org/docs/latest/api/dns.html#dnsresolvehostname-rrtype-callback '🐢 NodeJS dns.resolve'
[node-http-request]: https://nodejs.org/docs/latest/api/http.html#httprequestoptions-callback '🐢 NodeJS http.requsst'
[node-net-socket-connect]: https://nodejs.org/docs/latest/api/net.html#socketconnectoptions-connectlistener '🐢 NodeJS net.Socket#connect'
