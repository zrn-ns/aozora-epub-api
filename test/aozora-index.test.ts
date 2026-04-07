import { describe, it, expect, beforeAll } from "vitest";
import { AozoraIndex } from "../lib/aozora-index.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("AozoraIndex", () => {
  let index: AozoraIndex;

  beforeAll(() => {
    const csv = readFileSync(
      resolve(__dirname, "../test-fixtures/sample-index.csv"),
      "utf-8"
    );
    index = AozoraIndex.fromCsv(csv);
  });

  describe("getAuthorsByKanaPrefix", () => {
    it("ア行の作家を返す", () => {
      const authors = index.getAuthorsByKanaPrefix("ア");
      expect(authors).toHaveLength(2); // 芥川, 有島
      expect(authors[0].name).toBe("芥川龍之介");
      expect(authors[0].workCount).toBe(2);
      expect(authors[1].name).toBe("有島武郎");
      expect(authors[1].workCount).toBe(1);
    });

    it("タ行の作家を返す", () => {
      const authors = index.getAuthorsByKanaPrefix("タ");
      expect(authors).toHaveLength(1); // 太宰
      expect(authors[0].name).toBe("太宰治");
    });

    it("ナ行の作家を返す", () => {
      const authors = index.getAuthorsByKanaPrefix("ナ");
      expect(authors).toHaveLength(1); // 夏目
      expect(authors[0].name).toBe("夏目漱石");
    });

    it("該当なしの行は空配列", () => {
      const authors = index.getAuthorsByKanaPrefix("カ");
      expect(authors).toHaveLength(0);
    });
  });

  describe("getWorksByAuthorId", () => {
    it("芥川の作品2つを取得", () => {
      const works = index.getWorksByAuthorId(879);
      expect(works).toHaveLength(2);
      const titles = works.map(w => w.title);
      expect(titles).toContain("羅生門");
      expect(titles).toContain("鼻");
    });
  });

  describe("getWorksByTitleKanaPrefix", () => {
    it("ハ行の作品名で検索", () => {
      const works = index.getWorksByTitleKanaPrefix("ハ");
      expect(works).toHaveLength(2); // はな, はしれめろす
    });

    it("ワ行の作品名で検索", () => {
      const works = index.getWorksByTitleKanaPrefix("ワ");
      expect(works).toHaveLength(1); // わがはいはねこである
      expect(works[0].title).toBe("吾輩は猫である");
    });
  });

  describe("getWorksByNdc", () => {
    it("NDC 913の作品を全て取得", () => {
      const works = index.getWorksByNdc("913");
      expect(works).toHaveLength(5);
    });
  });

  describe("getNewestWorks", () => {
    it("公開日新しい順でN件取得", () => {
      const works = index.getNewestWorks(2);
      expect(works).toHaveLength(2);
      // 2001-03-15 が最新
      expect(works[0].title).toBe("或る女");
    });
  });

  describe("getWorkById", () => {
    it("作品IDで1件取得", () => {
      const work = index.getWorkById(879);
      expect(work).not.toBeNull();
      expect(work!.title).toBe("羅生門");
      expect(work!.textUrl).toContain("aozora.gr.jp");
    });

    it("存在しないIDはnull", () => {
      const work = index.getWorkById(999999);
      expect(work).toBeNull();
    });
  });
});
