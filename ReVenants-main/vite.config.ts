import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Load root .env variables so that server-side code (process.env) has access to them in dev & SSR
const env = loadEnv("development", process.cwd(), "");
Object.assign(process.env, env);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
