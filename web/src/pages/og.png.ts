import type { APIRoute } from 'astro';
import { renderOgImage } from '@/lib/og-image';

export const GET: APIRoute = async () => {
  const png = await renderOgImage();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
