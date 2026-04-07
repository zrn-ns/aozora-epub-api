import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { AozoraIndex } from "../lib/aozora-index.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const __dirname = dirname(fileURLToPath(import.meta.url));

// vi.hoisted() で生成したモック関数は vi.mock ファクトリ内でも参照可能
const { getIndexMock } = vi.hoisted(() => ({
  getIndexMock: vi.fn(),
}));

vi.mock("../lib/index-loader.js", () => ({
  getIndex: getIndexMock,
  resetIndexCache: vi.fn(),
}));

import handler from "../api/authors.js";

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

describe("GET /api/authors", () => {
  beforeAll(() => {
    const csv = readFileSync(
      resolve(__dirname, "../test-fixtures/sample-index.csv"),
      "utf-8"
    );
    const index = AozoraIndex.fromCsv(csv);
    getIndexMock.mockResolvedValue(index);
  });

  it("kana_prefix=ア で作者一覧を返す", async () => {
    const { req, res } = mockReqRes({ kana_prefix: "ア" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0] as {
      authors: Array<{ id: number; name: string; kana: string; work_count: number }>;
    };
    expect(body.authors.length).toBeGreaterThan(0);
    // 芥川龍之介が含まれること
    const akutagawa = body.authors.find((a) => a.name === "芥川龍之介");
    expect(akutagawa).toBeDefined();
    expect(akutagawa?.work_count).toBe(2);
    // レスポンス形式の確認（id, name, kana, work_count）
    expect(akutagawa).toHaveProperty("id");
    expect(akutagawa).toHaveProperty("kana");
  });

  it("kana_prefix が存在しない場合は 400 を返す", async () => {
    const { req, res } = mockReqRes({});
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = vi.mocked(res.json).mock.calls[0][0] as { error: string };
    expect(body.error).toBe("BadRequest");
  });

  it("getIndex がエラーを投げた場合は 500 を返す", async () => {
    getIndexMock.mockRejectedValueOnce(new Error("ネットワークエラー"));

    const { req, res } = mockReqRes({ kana_prefix: "ア" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = vi.mocked(res.json).mock.calls[0][0] as {
      error: string;
      message: string;
    };
    expect(body.error).toBe("InternalServerError");
    expect(body.message).toContain("ネットワークエラー");
  });
});
