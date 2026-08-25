import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import {
  assertBrowserBuildEnvIsUsable,
  createFrontendReleaseManifest,
} from "./release-manifest";

const releaseManifestPlugin = (
  env: Record<string, string | undefined>,
): Plugin => ({
  name: "pos-release-manifest",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "release.json",
      source: `${JSON.stringify(createFrontendReleaseManifest(env), null, 2)}\n`,
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const releaseEnv = { ...fileEnv, ...process.env };
  assertBrowserBuildEnvIsUsable(releaseEnv);

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      releaseManifestPlugin(releaseEnv),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
