const EMBEDDED_ASSETS = "__EMBEDDED_ASSET_MANIFEST__"

function decodeBase64(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function assetResponse(request, pathname) {
  const asset = EMBEDDED_ASSETS[pathname]
  if (!asset) return null

  let body = asset.encoding === 'base64' ? decodeBase64(asset.body) : asset.body
  if (pathname === '/index.html') {
    body = body.replaceAll('__SITE_ORIGIN__', new URL(request.url).origin)
  }

  const headers = new Headers({
    'Content-Type': asset.contentType,
    'X-Content-Type-Options': 'nosniff',
  })
  if (pathname.startsWith('/assets/')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  } else if (pathname === '/index.html') {
    headers.set('Cache-Control', 'no-cache')
  } else {
    headers.set('Cache-Control', 'public, max-age=3600')
  }

  return new Response(request.method === 'HEAD' ? null : body, { headers })
}

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      })
    }

    const url = new URL(request.url)
    const exact = assetResponse(request, url.pathname)
    if (exact) return exact

    return assetResponse(request, '/index.html') ?? new Response('Not Found', { status: 404 })
  },
}
