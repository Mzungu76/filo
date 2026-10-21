const android = process.env.BUILD_TARGET === "android";

/** @type {import('next').NextConfig} */
const nextConfig = android
  // App Android (Capacitor): esportazione statica servita dentro l'APK.
  ? { output: "export", images: { unoptimized: true } }
  : {
      headers: async () => [
        {
          source: "/sw.js",
          headers: [
            { key: "Content-Type", value: "application/javascript; charset=utf-8" },
            { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }
          ]
        }
      ]
    };
export default nextConfig;
