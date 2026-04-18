import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getFunctionsBaseUrl() {
  return (
    process.env.FUNCTIONS_BASE_URL ||
    process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ||
    ''
  ).replace(/\/$/, '');
}

async function proxy(request: NextRequest, path: string[]) {
  const baseUrl = getFunctionsBaseUrl();

  if (!baseUrl) {
    return new Response('FUNCTIONS_BASE_URL is not configured.', { status: 500 });
  }

  const upstreamUrl = new URL(`${baseUrl}/${path.join('/')}`);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}

export async function GET(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context.params.path || []);
}

export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context.params.path || []);
}

export async function PUT(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context.params.path || []);
}

export async function PATCH(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context.params.path || []);
}

export async function DELETE(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context.params.path || []);
}

export async function OPTIONS(request: NextRequest, context: { params: { path: string[] } }) {
  return proxy(request, context.params.path || []);
}
