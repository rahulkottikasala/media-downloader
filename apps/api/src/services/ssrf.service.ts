import dns from 'dns';
import net from 'net';

/**
 * Checks whether an IPv4 address is in a reserved/private range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [a, b, c, d] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (172.16.0.0 – 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  // Multicast & Reserved (224.0.0.0/4 and 240.0.0.0/4)
  if (a >= 224) return true;

  return false;
}

/**
 * Checks whether an IPv6 address is in a reserved/private range.
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  // ::1 loopback
  if (lower === '::1' || lower === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  // :: unspecified
  if (lower === '::' || lower === '0000:0000:0000:0000:0000:0000:0000:0000') return true;

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (lower.startsWith('::ffff:') || lower.startsWith('0:0:0:0:0:ffff:')) {
    const ipv4Part = lower.split(':').pop();
    if (ipv4Part && net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
    return true;
  }

  // fc00::/7 (Unique Local Address)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  // fe80::/10 (Link-Local)
  if (
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) {
    return true;
  }

  // ff00::/8 (Multicast)
  if (lower.startsWith('ff')) return true;

  return false;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateIPv6(ip);
  }
  return true; // Unknown IP family -> treat as unsafe
}

export interface SafeUrlValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
  resolvedIp?: string;
}

export async function validateSafeUrl(urlString: string): Promise<SafeUrlValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: 'Malformed URL' };
  }

  // Scheme validation
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `Unsupported scheme: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
    };
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    return { valid: false, error: 'URL must contain a valid hostname' };
  }

  // Allow localhost mock server ONLY during explicit local test execution
  if (process.env.ALLOW_TEST_LOCAL_MEDIA === 'true' && (hostname === '127.0.0.1' || hostname === 'localhost')) {
    return { valid: true, url: parsed, resolvedIp: '127.0.0.1' };
  }

  // Block localhost, 127.0.0.1, 0.0.0.0, internal hostnames
  const lowerHostname = hostname.toLowerCase();
  if (
    lowerHostname === 'localhost' ||
    lowerHostname.endsWith('.local') ||
    lowerHostname.endsWith('.internal') ||
    lowerHostname.endsWith('.corp') ||
    lowerHostname.endsWith('.lan')
  ) {
    return { valid: false, error: 'Access to local and private network hostnames is prohibited' };
  }

  // If the hostname is already an IP address
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { valid: false, error: 'Access to private, loopback, and local IP addresses is prohibited' };
    }
    return { valid: true, url: parsed, resolvedIp: hostname };
  }

  // Resolve DNS
  try {
    const lookupResult = await dns.promises.lookup(hostname, { all: true });
    if (!lookupResult || lookupResult.length === 0) {
      return { valid: false, error: `Could not resolve hostname "${hostname}"` };
    }

    for (const record of lookupResult) {
      if (isPrivateIp(record.address)) {
        return {
          valid: false,
          error: `Hostname "${hostname}" resolves to protected private IP ${record.address}`,
        };
      }
    }

    return { valid: true, url: parsed, resolvedIp: lookupResult[0].address };
  } catch (err: any) {
    return { valid: false, error: `DNS resolution failed for "${hostname}": ${err.message}` };
  }
}
