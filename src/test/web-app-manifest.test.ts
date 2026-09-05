import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const projectFile = (filePath: string) => path.join(process.cwd(), filePath);

describe("installed POS web app metadata", () => {
  it("opens from the iPad Home Screen without the browser URL bar", async () => {
    const html = await readFile(projectFile("index.html"), "utf8");
    const manifest = JSON.parse(
      await readFile(projectFile("public/manifest.webmanifest"), "utf8"),
    ) as {
      display?: string;
      start_url?: string;
      scope?: string;
      icons?: Array<{ src?: string; sizes?: string }>;
    };

    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="mobile-web-app-capable" content="yes"');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180"');
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/pos-app-icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/pos-app-icon-512.png", sizes: "512x512" }),
    ]));
  });
});
