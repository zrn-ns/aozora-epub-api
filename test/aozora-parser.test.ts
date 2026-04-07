import { describe, it, expect } from "vitest";
import { parseAozoraText } from "../lib/aozora-parser.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("parseAozoraText", () => {
  const sampleText = readFileSync(
    resolve(__dirname, "../test-fixtures/sample-aozora.txt"),
    "utf-8"
  );

  it("ヘッダー（記号説明ブロック）を除去する", () => {
    const nodes = parseAozoraText(sampleText);
    const allText = nodes
      .filter((n) => n.type === "text")
      .map((n) => n.content)
      .join("");
    expect(allText).not.toContain("【テキスト中に現れる記号について】");
    expect(allText).not.toContain("-------");
  });

  it("タイトル行を除去する", () => {
    const nodes = parseAozoraText(sampleText);
    const allText = nodes
      .filter((n) => n.type === "text")
      .map((n) => n.content)
      .join("");
    expect(allText).not.toContain("テスト作品");
    expect(allText).not.toContain("テスト著者");
  });

  it("ルビを正しくパースする", () => {
    const nodes = parseAozoraText(sampleText);
    const rubyNodes = nodes.filter((n) => n.type === "ruby");
    expect(rubyNodes.length).toBeGreaterThanOrEqual(4); // げにん, らしょうもん, くさめ, たいぎ
    const rashomon = rubyNodes.find(
      (n) => n.type === "ruby" && n.base === "羅生門"
    );
    expect(rashomon).toBeDefined();
    if (rashomon && rashomon.type === "ruby") {
      expect(rashomon.reading).toBe("らしょうもん");
    }
  });

  it("大見出しをパースする", () => {
    const nodes = parseAozoraText(sampleText);
    const headings = nodes.filter((n) => n.type === "heading");
    expect(headings.length).toBe(2);
    if (headings[0].type === "heading") {
      expect(headings[0].level).toBe(1);
    }
  });

  it("字下げをパースする", () => {
    const nodes = parseAozoraText(sampleText);
    const indents = nodes.filter((n) => n.type === "indent");
    expect(indents.length).toBeGreaterThanOrEqual(2);
    if (indents[0].type === "indent") {
      expect(indents[0].chars).toBe(3);
    }
  });

  it("改ページをパースする", () => {
    const nodes = parseAozoraText(sampleText);
    const pagebreaks = nodes.filter((n) => n.type === "pagebreak");
    expect(pagebreaks.length).toBe(1);
  });

  it("底本注記を保持する", () => {
    const nodes = parseAozoraText(sampleText);
    const textNodes = nodes.filter((n) => n.type === "text");
    const hasColophon = textNodes.some(
      (n) => n.type === "text" && n.content.includes("底本")
    );
    expect(hasColophon).toBe(true);
  });
});
