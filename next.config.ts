import type { NextConfig } from "next";

// Hinweis: cacheComponents bleibt bewusst aus. Die App ist komplett
// personalisiert (Login), daher rendern alle Seiten dynamisch pro Request.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
