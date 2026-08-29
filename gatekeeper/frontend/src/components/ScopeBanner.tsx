/**
 * Rules-of-engagement banner for publicly hosted instances.
 *
 * Yggdrasil is meant to be attacked, so a player arriving at a public
 * deployment needs to be told — before they start — which host is the target
 * and what is merely in the path. Local play needs none of that, so the banner
 * renders only when the page is served from somewhere other than a loopback
 * address. The in-scope host is read from the page's own origin, so it is
 * always accurate without the frontend needing to be rebuilt per deployment.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

export function isHostedOrigin(hostname: string): boolean {
  if (LOCAL_HOSTNAMES.has(hostname)) return false;
  // *.localhost and *.local resolve locally and are used for dev proxies.
  if (hostname.endsWith('.localhost') || hostname.endsWith('.local')) return false;
  return true;
}

export function ScopeBanner() {
  if (typeof window === 'undefined' || !isHostedOrigin(window.location.hostname)) {
    return null;
  }

  const origin = window.location.origin;

  return (
    <div
      role="region"
      aria-label="Rules of engagement"
      className="bg-amber-950/60 border-b border-amber-500/30 text-amber-100"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 text-sm">
        <p className="font-semibold text-amber-200">
          Hosted instance — attack <span className="font-mono">{origin}</span> and nothing else.
        </p>
        <p className="mt-1 text-amber-100/80">
          The realms are meant to be broken. The network in front of them is not: Cloudflare, the
          hosting provider and every other host are out of scope, as are other players. No
          denial-of-service or volumetric traffic.{' '}
          <a
            href="/.well-known/security.txt"
            className="underline underline-offset-2 hover:text-amber-50"
          >
            Full scope and contact
          </a>
          .
        </p>
      </div>
    </div>
  );
}
