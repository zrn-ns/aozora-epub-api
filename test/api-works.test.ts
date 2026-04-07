import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { AozoraIndex } from "../lib/aozora-index.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { getIndexMock } = vi.hoisted(() => ({
  getIndexMock: vi.fn(),
}));

vi.mock("../lib/index-loader.js", () => ({
  getIndex: getIndexMock,
  resetIndexCache: vi.fn(),
}));

import handler from "../api/works.js";

function mockReqRes(query: Record<string, string>) {
  const req = { query } as unknown as VercelRequest;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    end: vi.fn(),
  } as unknown as VercelResponse;
  return { req, res };
}

type WorkItem = { id: number; title: string; kana: string; ndc: string };

describe("GET /api/works", () => {
  beforeAll(() => {
    const csv = readFileSync(
      resolve(__dirname, "../test-fixtures/sample-index.csv"),
      "utf-8"
    );
    const index = AozoraIndex.fromCsv(csv);
    getIndexMock.mockResolvedValue(index);
  });

  it("author_id=879 で作品一覧を返す", async () => {
    const { req, res } = mockReqRes({ author_id: "879" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0] as { works: WorkItem[] };
    expect(body.works.length).toBeGreaterThan(0);
    // 芥川龍之介の作品（羅生門, 鼻）が含まれる
    const titles = body.works.map((w) => w.title);
    expect(titles).toContain("羅生門");
    expect(titles).toContain("鼻");
    // レスポンス形式の確認
    expect(body.works[0]).toHaveProperty("id");
    expect(body.works[0]).toHaveProperty("title");
    expect(body.works[0]).toHaveProperty("kana");
    expect(body.works[0]).toHaveProperty("ndc");
  });

  it("kana_prefix=ハ で作品一覧を返す", async () => {
    const { req, res } = mockReqRes({ kana_prefix: "ハ" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0] as { works: WorkItem[] };
    // 「鼻」(はな) が含まれる
    const titles = body.works.map((w) => w.title);
    expect(titles).toContain("鼻");
  });

  it("ndc=913 で作品一覧を返す", async () => {
    const { req, res } = mockReqRes({ ndc: "913" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0] as { works: WorkItem[] };
    expect(body.works.length).toBeGreaterThan(0);
    // 全作品のNDCが913であること
    body.works.forEach((w) => expect(w.ndc).toBe("913"));
  });

  it("sort=newest で作品一覧を返す", async () => {
    const { req, res } = mockReqRes({ sort: "newest", limit: "3" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0] as { works: WorkItem[] };
    expect(body.works.length).toBeGreaterThan(0);
    expect(body.works.length).toBeLessThanOrEqual(3);
  });

  it("パラメータなしは 400 を返す", async () => {
    const { req, res } = mockReqRes({});
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = vi.mocked(res.json).mock.calls[0][0] as { error: string };
    expect(body.error).toBe("BadRequest");
  });

  it("author_id が数値でない場合は 400 を返す", async () => {
    const { req, res } = mockReqRes({ author_id: "abc" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = vi.mocked(res.json).mock.calls[0][0] as { error: string };
    expect(body.error).toBe("BadRequest");
  });
});
