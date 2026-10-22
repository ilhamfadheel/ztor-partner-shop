import { config } from "@/lib/config";

/**
 * The public configuration as an ES module for the LLOUD pages (static files under public/, which
 * cannot read NEXT_PUBLIC_* themselves): `import config from "/lloud-config.js"`. Public values only.
 */
export const dynamic = "force-static";

export function GET() {
  const { issuer, api, clientId, shopResource, media } = config;
  return new Response(`export default ${JSON.stringify({ issuer, api, clientId, shopResource: shopResource ?? null, media })};\n`, {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
