/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist's default build statically references the optional
    // `canvas` package (a Node-only fallback we never hit, since PDF
    // rendering here only ever runs in the browser).
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
