import type { APIRoute } from 'astro';

export const GET: APIRoute = (context) => {
  const sitemap = new URL('/sitemap-index.xml', context.site ?? context.url);

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
