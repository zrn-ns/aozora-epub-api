import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getIndex } from "../lib/index-loader.js";
import { handleCors } from "../lib/cors.js";
import { fetchAozoraText } from "../lib/aozora-fetcher.js";
import { parseAozoraText } from "../lib/aozora-parser.js";
import { splitChapters } from "../lib/chapter-splitter.js";
import { buildEpub } from "../lib/epub-builder.js";
import type { ApiError } from "../lib/types.js";

/**
 * GET /api/convert?work_id=879
 *
 * 作品IDを受け取り、青空文庫テキストをEPUB形式に変換して返す。
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (handleCors(req, res)) return;

  const { work_id } = req.query;

  if (!work_id) {
    const error: ApiError = {
      error: "BadRequest",
      message: "クエリパラメータ work_id が必要です（例: ?work_id=879）",
    };
    res.status(400).json(error);
    return;
  }

  const workId = parseInt(String(work_id), 10);
  if (isNaN(workId)) {
    const error: ApiError = {
      error: "BadRequest",
      message: "work_id は整数で指定してください",
    };
    res.status(400).json(error);
    return;
  }

  // インデックスから作品情報を取得
  let index;
  try {
    index = await getIndex();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error: ApiError = { error: "InternalServerError", message };
    res.status(500).json(error);
    return;
  }

  const work = index.getWorkById(workId);
  if (!work) {
    const error: ApiError = {
      error: "NotFound",
      message: `作品ID ${workId} が見つかりません`,
    };
    res.status(404).json(error);
    return;
  }

  // 青空文庫からテキストを取得
  let rawText: string;
  try {
    rawText = await fetchAozoraText(work.textUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error: ApiError = {
      error: "BadGateway",
      message: `青空文庫サーバーからのテキスト取得に失敗しました: ${message}`,
    };
    res.status(502).json(error);
    return;
  }

  // テキスト → EPUB 変換
  try {
    const nodes = parseAozoraText(rawText);
    const chapters = splitChapters(nodes);
    const epubBuffer = await buildEpub({
      title: work.title,
      author: work.authorName,
      chapters,
    });

    // ファイル名をASCIIセーフにエンコード
    const safeTitle = encodeURIComponent(work.title);
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Length", String(epubBuffer.length));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeTitle}.epub"; filename*=UTF-8''${safeTitle}.epub`
    );
    res.status(200).end(epubBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error: ApiError = {
      error: "InternalServerError",
      message: `EPUB変換中にエラーが発生しました: ${message}`,
    };
    res.status(500).json(error);
  }
}
