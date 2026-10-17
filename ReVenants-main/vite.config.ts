import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Load root .env variables so that server-side code (process.env) has access to them in dev & SSR
const env = loadEnv("development", process.cwd(), "");
Object.assign(process.env, env);

// Switch to node-server preset for Render/VPS; keep cloudflare-module for Lovable Cloud
const useNodePreset =
  !!process.env["RENDER"] || process.env["NITRO_PRESET"] === "node-server";

export default defineConfig({
  // Only deliberately public variables may enter the browser bundle. This
  // prevents an accidentally named VITE_ service key from being exposed.
  vite: { envPrefix: "PUBLIC_" },
  envDefine: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // node-server preset produces a self-contained HTTP server at .output/server/index.mjs
    ...(useNodePreset ? { nitro: { preset: "node-server" } } : {}),
  },
});
