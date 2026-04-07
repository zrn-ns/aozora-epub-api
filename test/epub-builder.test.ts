import { describe, it, expect } from "vitest";
import { buildEpub } from "../lib/epub-builder.js";
import type { Chapter, AozoraNode } from "../lib/types.js";
import AdmZip from "adm-zip";

describe("buildEpub", () => {
  const chapters: Chapter[] = [
    {
      title: "第一章",
      nodes: [
        { type: "text", content: "テスト" } as AozoraNode,
        { type: "ruby", base: "漢字", reading: "かんじ" } as AozoraNode,
      ],
    },
    {
      title: "第二章",
      nodes: [{ type: "text", content: "内容" } as AozoraNode],
    },
  ];

  it("有効なEPUB ZIPを生成する", async () => {
    const buffer = await buildEpub({
      title: "テスト書籍",
      author: "テスト著者",
      chapters,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().map((e) => e.entryName);

    expect(entries).toContain("mimetype");
    expect(entries).toContain("META-INF/container.xml");
    expect(entries).toContain("OEBPS/content.opf");
    expect(entries).toContain("OEBPS/nav.xhtml");
    expect(entries).toContain("OEBPS/style.css");
    expect(entries).toContain("OEBPS/chapter_001.xhtml");
    expect(entries).toContain("OEBPS/chapter_002.xhtml");
  });

  it("mimetypeの内容が正しい", async () => {
    const buffer = await buildEpub({
      title: "テスト",
      author: "著者",
      chapters: [{ title: "", nodes: [{ type: "text", content: "a" }] }],
    });

    const zip = new AdmZip(buffer);
    const mimetype = zip.getEntry("mimetype");
    expect(mimetype).not.toBeNull();
    expect(mimetype!.getData().toString()).toBe("application/epub+zip");
  });

  it("XHTMLにルビタグが含まれる", async () => {
    const buffer = await buildEpub({
      title: "テスト",
      author: "著者",
      chapters,
    });

    const zip = new AdmZip(buffer);
    const ch1 = zip.getEntry("OEBPS/chapter_001.xhtml");
    const content = ch1!.getData().toString("utf-8");
    expect(content).toContain("<ruby>漢字<rt>かんじ</rt></ruby>");
  });

  it("nav.xhtmlに目次が含まれる", async () => {
    const buffer = await buildEpub({
      title: "テスト",
      author: "著者",
      chapters,
    });

    const zip = new AdmZip(buffer);
    const nav = zip.getEntry("OEBPS/nav.xhtml");
    const content = nav!.getData().toString("utf-8");
    expect(content).toContain("第一章");
    expect(content).toContain("第二章");
  });

  it("content.opfにメタデータが含まれる", async () => {
    const buffer = await buildEpub({
      title: "テスト書籍",
      author: "テスト著者",
      chapters,
    });

    const zip = new AdmZip(buffer);
    const opf = zip.getEntry("OEBPS/content.opf");
    const content = opf!.getData().toString("utf-8");
    expect(content).toContain("テスト書籍");
    expect(content).toContain("テスト著者");
    expect(content).toContain("<dc:language>ja</dc:language>");
  });

  it("単一チャプターでも動作する", async () => {
    const buffer = await buildEpub({
      title: "短編",
      author: "作者",
      chapters: [{ title: "本文", nodes: [{ type: "text", content: "短い話" }] }],
    });

    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toContain("OEBPS/chapter_001.xhtml");
    expect(entries).not.toContain("OEBPS/chapter_002.xhtml");
  });
});
