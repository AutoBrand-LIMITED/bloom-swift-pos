import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";

export interface PdfEvidence {
  pdfPath: string;
  pngPath: string;
  pngPaths: string[];
  htmlText: string;
  pdfText: string;
  pageTexts: string[];
  pages: number;
  bytes: number;
  printCalls: number;
}

export async function capturePrintPopup(
  page: Page,
  trigger: Locator,
  pdfPath: string,
): Promise<PdfEvidence> {
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  const popupPromise = page.waitForEvent("popup");
  await trigger.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await popup.evaluate(() => {
    const target = window as typeof window & { __posE2ePrintCalls?: number };
    target.__posE2ePrintCalls = 0;
    window.print = () => {
      target.__posE2ePrintCalls = (target.__posE2ePrintCalls || 0) + 1;
    };
  });
  await popup.waitForTimeout(350);
  const printCalls = await popup.evaluate(
    () => (window as typeof window & { __posE2ePrintCalls?: number }).__posE2ePrintCalls || 0,
  );
  await popup.emulateMedia({ media: "print" });
  const htmlText = await popup.locator("body").innerText();
  await popup.pdf({
    path: pdfPath,
    preferCSSPageSize: true,
    printBackground: true,
  });
  await popup.close();
  return inspectPdf(pdfPath, htmlText, printCalls);
}

export function inspectPdf(pdfPath: string, htmlText = "", printCalls = 0): PdfEvidence {
  const pdfText = execFileSync("/opt/homebrew/bin/pdftotext", [pdfPath, "-"], {
    encoding: "utf8",
  });
  const info = execFileSync("/opt/homebrew/bin/pdfinfo", [pdfPath], { encoding: "utf8" });
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
  const pageTexts = Array.from({ length: pages }, (_, index) => execFileSync(
    "/opt/homebrew/bin/pdftotext",
    ["-f", String(index + 1), "-l", String(index + 1), pdfPath, "-"],
    { encoding: "utf8" },
  ));
  const pngPaths = Array.from({ length: pages }, (_, index) => {
    const pageNumber = index + 1;
    const pngBase = pdfPath.replace(/\.pdf$/i, `-page-${pageNumber}`);
    execFileSync("/opt/homebrew/bin/pdftoppm", [
      "-f", String(pageNumber),
      "-l", String(pageNumber),
      "-singlefile",
      "-png",
      "-r", "120",
      pdfPath,
      pngBase,
    ]);
    return `${pngBase}.png`;
  });
  const pngPath = pngPaths[0] || "";
  return {
    pdfPath,
    pngPath,
    pngPaths,
    htmlText,
    pdfText,
    pageTexts,
    pages,
    bytes: fs.statSync(pdfPath).size,
    printCalls,
  };
}
