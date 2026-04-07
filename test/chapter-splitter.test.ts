import { describe, it, expect } from "vitest";
import { splitChapters } from "../lib/chapter-splitter.js";
import type { AozoraNode } from "../lib/types.js";

describe("splitChapters", () => {
  it("見出しで章分割する", () => {
    const nodes: AozoraNode[] = [
      { type: "text", content: "序文テキスト" },
      { type: "newline" },
      { type: "heading", level: 1, children: [{ type: "text", content: "第一章" }] },
      { type: "newline" },
      { type: "text", content: "第一章の内容" },
      { type: "newline" },
      { type: "heading", level: 1, children: [{ type: "text", content: "第二章" }] },
      { type: "newline" },
      { type: "text", content: "第二章の内容" },
    ];

    const chapters = splitChapters(nodes);
    expect(chapters).toHaveLength(3);
    expect(chapters[0].title).toBe(""); // preamble
    expect(chapters[1].title).toBe("第一章");
    expect(chapters[2].title).toBe("第二章");
  });

  it("改ページで章分割する", () => {
    const nodes: AozoraNode[] = [
      { type: "text", content: "前半" },
      { type: "pagebreak" },
      { type: "text", content: "後半" },
    ];

    const chapters = splitChapters(nodes);
    expect(chapters).toHaveLength(2);
  });

  it("章区切りが0個なら単一チャプター", () => {
    const nodes: AozoraNode[] = [
      { type: "text", content: "全テキスト" },
    ];

    const chapters = splitChapters(nodes);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("");
  });

  it("空の序文チャプターは除外する", () => {
    const nodes: AozoraNode[] = [
      { type: "newline" },
      { type: "heading", level: 1, children: [{ type: "text", content: "第一章" }] },
      { type: "text", content: "内容" },
    ];

    const chapters = splitChapters(nodes);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("第一章");
  });

  it("ルビを含む見出しテキストを正しく抽出する", () => {
    const nodes: AozoraNode[] = [
      { type: "heading", level: 1, children: [
        { type: "ruby", base: "羅生門", reading: "らしょうもん" },
      ]},
      { type: "text", content: "内容" },
    ];

    const chapters = splitChapters(nodes);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("羅生門");
  });
});
