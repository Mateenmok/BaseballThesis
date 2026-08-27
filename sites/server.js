async function withOriginMetadata(request, response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return response

  const origin = new URL(request.url).origin
  const body = (await response.text()).replaceAll('__SITE_ORIGIN__', origin)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(body, { status: response.status, headers })
}

function withSpaFallback(request, assets) {
  return assets.fetch(new Request(new URL('/index.html', request.url), request))
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404 || request.method !== 'GET') {
      return withOriginMetadata(request, response)
    }
    const fallback = await withSpaFallback(request, env.ASSETS)
    return withOriginMetadata(request, fallback)
  },
}
