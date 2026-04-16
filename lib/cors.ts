import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * CORSヘッダーを設定する。
 * OPTIONSリクエスト（プリフライト）の場合は 204 を返して true を返す。
 * 呼び出し側は true が返った場合にそのまま return すること。
 */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
