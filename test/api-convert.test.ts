import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { AozoraIndex } from "../lib/aozora-index.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { getIndexMock, fetchAozoraTextMock } = vi.hoisted(() => ({
  getIndexMock: vi.fn(),
  fetchAozoraTextMock: vi.fn(),
}));

vi.mock("../lib/index-loader.js", () => ({
  getIndex: getIndexMock,
  resetIndexCache: vi.fn(),
}));

vi.mock("../lib/aozora-fetcher.js", () => ({
  fetchAozoraText: fetchAozoraTextMock,
}));

import handler from "../api/convert.js";

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

describe("GET /api/convert", () => {
  beforeAll(() => {
    const csv = readFileSync(
      resolve(__dirname, "../test-fixtures/sample-index.csv"),
      "utf-8"
    );
    const index = AozoraIndex.fromCsv(csv);
    getIndexMock.mockResolvedValue(index);

    const fixtureText = readFileSync(
      resolve(__dirname, "../test-fixtures/sample-aozora.txt"),
      "utf-8"
    );
    fetchAozoraTextMock.mockResolvedValue(fixtureText);
  });

  it("有効な work_id=879 で EPUB バイナリを返す", async () => {
    const { req, res } = mockReqRes({ work_id: "879" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/epub+zip"
    );
    // Content-Disposition ヘッダが設定されていること
    const dispositionCall = vi.mocked(res.setHeader).mock.calls.find(
      (c) => c[0] === "Content-Disposition"
    );
    expect(dispositionCall).toBeDefined();
    expect(String(dispositionCall?.[1])).toContain(".epub");
    // end() にバッファが渡されていること
    expect(res.end).toHaveBeenCalled();
    const epubBuffer = vi.mocked(res.end).mock.calls[0][0] as Buffer;
    expect(Buffer.isBuffer(epubBuffer)).toBe(true);
    expect(epubBuffer.length).toBeGreaterThan(0);
  });

  it("work_id が存在しない場合は 400 を返す", async () => {
    const { req, res } = mockReqRes({});
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = vi.mocked(res.json).mock.calls[0][0] as { error: string };
    expect(body.error).toBe("BadRequest");
  });

  it("存在しない work_id=99999 は 404 を返す", async () => {
    const { req, res } = mockReqRes({ work_id: "99999" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    const body = vi.mocked(res.json).mock.calls[0][0] as { error: string };
    expect(body.error).toBe("NotFound");
  });

  it("fetchAozoraText がエラーを投げた場合は 502 を返す", async () => {
    fetchAozoraTextMock.mockRejectedValueOnce(new Error("Connection refused"));

    const { req, res } = mockReqRes({ work_id: "879" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    const body = vi.mocked(res.json).mock.calls[0][0] as {
      error: string;
      message: string;
    };
    expect(body.error).toBe("BadGateway");
    expect(body.message).toContain("Connection refused");
  });
});
