const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function gatewayHosts(env) {
  const custom = [env.GATEWAY_PUBLIC_HOST, env.GATEWAY_CRM_HOST];
  if (!label.test(env.GATEWAY_PROJECT || '') ||
      env.GATEWAY_PAGES_HOST !== `${env.GATEWAY_PROJECT}.pages.dev`) return null;
  if (!custom.every(host => typeof host === 'string' && host.length <= 253 &&
      host.split('.').length >= 3 && host.split('.').every(part => label.test(part)) &&
      !host.endsWith('.pages.dev') && !host.endsWith('.workers.dev') &&
      /[a-z]/.test(host.split('.').at(-1)))) return null;
  const hosts = new Set([...custom, env.GATEWAY_PAGES_HOST]);
  return hosts.size === 3 ? hosts : null;
}

function unavailable(status, message) {
  return new Response(message, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
}

export default {
  async fetch(request, env) {
    const hosts = gatewayHosts(env);
    if (!hosts) return unavailable(503, 'Gateway configuration is unavailable.');
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || !hosts.has(url.host)) {
      return unavailable(421, 'This hostname is not configured for this service.');
    }
    if (typeof env.FUNNEL?.fetch !== 'function') return unavailable(503, 'Gateway service is unavailable.');
    try {
      // Keep the original URL and Origin for the backend's host routing and CSRF checks.
      return await env.FUNNEL.fetch(request);
    } catch {
      return unavailable(502, 'Gateway service could not be reached.');
    }
  }
};
