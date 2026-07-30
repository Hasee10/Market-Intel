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
  images: {
    domains: [
      'images.unsplash.com',
      'i.ibb.co',
      'scontent.fotp8-1.fna.fbcdn.net',
    ],
    // Make ENV
    unoptimized: true,
  },
};

// module.exports = withTM(nextConfig);
module.exports = nextConfig;
