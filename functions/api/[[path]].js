const API_ORIGIN = 'https://elite-voucher-api.ronybd.workers.dev';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = `${API_ORIGIN}${url.pathname}${url.search}`;
  const upstreamRequest = new Request(target, request);
  return fetch(upstreamRequest);
}
