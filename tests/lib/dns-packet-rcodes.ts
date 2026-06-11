declare module 'dns-packet/rcodes' {
  type String =
    | 'NOERROR'
    | 'FORMERR'
    | 'SERVFAIL'
    | 'NXDOMAIN'
    | 'NOTIMP'
    | 'REFUSED'
    | 'YXDOMAIN'
    | 'YXRRSET'
    | 'NXRRSET'
    | 'NOTAUTH'
    | 'NOTZONE'
    | 'RCODE_11'
    | 'RCODE_12'
    | 'RCODE_13'
    | 'RCODE_14'
    | 'RCODE_15'
    | `RCODE_${number}`;
  type Code = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | number;

  export function toString(code: Code): String;

  export function toRcode(string: String): Code;
}
