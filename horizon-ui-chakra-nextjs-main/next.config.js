/** @type {import('next').NextConfig} */

const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH,
  // pdfkit loads its .afm font metric files from disk via a relative path at
  // runtime - webpack bundling that path breaks it (ENOENT under
  // .next/server/vendor-chunks). Keeping it external makes Next require()
  // it straight from node_modules instead, where the relative path works.
  serverExternalPackages: ['pdfkit'],
  // Vercel's file-tracer doesn't always pick up pdfkit's .afm data files
  // since they're loaded via a runtime fs path, not a static import -
  // forcing them into the traced output avoids the same ENOENT in
  // production that serverExternalPackages alone fixed locally.
  outputFileTracingIncludes: {
    '/api/reports/generate': [
      './node_modules/pdfkit/js/data/**/*',
      // The real .pptx report template is read via a process.cwd()-built
      // path at runtime (see lib/reports/generate-pptx.ts), which Next's
      // file tracer can't resolve statically - without this the file is
      // silently missing from the deployed function.
      './src/lib/reports/assets/**/*',
    ],
  },
  // No `experimental.optimizePackageImports` block here on purpose. It was
  // tried for @chakra-ui/react and react-icons and produced a byte-identical
  // build - same chunk hashes, same 103 kB shared JS - because Next 15
  // already applies it to both by default. Listing them again is dead config
  // that reads like a win without being one.
  images: {
    domains: [
      'images.unsplash.com',
      'i.ibb.co',
      'scontent.fotp8-1.fna.fbcdn.net',
      // Testimonial avatars (components/landing/testimonials.ts). This is a
      // free fake-identity generator, so the faces are stock, not the named
      // customers - fine as a placeholder, wrong to leave in front of real
      // names long-term. Drop this entry once those are replaced with real
      // photos or with the initials fallback.
      'randomuser.me',
    ],
    // Was `unoptimized: true`, which meant next/image served every asset at
    // full original size in its original format. The landing page's four
    // illustrations alone are ~1.9MB of raw PNG that way; with optimization
    // on they're re-encoded to AVIF/WebP and sized to the actual layout
    // slot, which is most of that weight gone off the first paint.
    formats: ['image/avif', 'image/webp'],
  },
  // leaks.md finding #4 - none of these were set. Applied to every route
  // rather than a subset: there's no page here that benefits from being
  // framed, sniffed, or from leaking a full referrer cross-origin.
  //
  // No Content-Security-Policy yet, deliberately. Chakra/Emotion inject
  // styles at runtime and would need 'unsafe-inline' for style-src, so a
  // CSP written today would be weak enough to give false assurance while
  // still risking breakage. It needs a nonce-based setup done properly -
  // tracked as its own item rather than bolted on here.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Clickjacking: nothing here is meant to be embedded.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stops the browser second-guessing our Content-Type, which is
          // what turns an uploaded/returned file into stored XSS.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Send the origin cross-site, full URL same-origin: seller
          // dashboard paths carry ids we don't want in third-party logs.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // We use none of these; deny by default so a future dependency
          // can't quietly start asking.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Only meaningful over HTTPS; Vercel terminates TLS so this is
          // always the case in production. 2 years, per the HSTS preload
          // requirement, in case we submit the domain later.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

// module.exports = withTM(nextConfig);
module.exports = nextConfig;
