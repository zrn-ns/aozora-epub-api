import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getIndex } from "../lib/index-loader.js";
import { handleCors } from "../lib/cors.js";
import type { WorksResponse, ApiError } from "../lib/types.js";
import type { Work } from "../lib/types.js";

/** Work を WorksResponse の要素形式に変換する */
function toWorkItem(w: Work) {
  return {
    id: w.id,
    title: w.title,
    kana: w.titleKana,
    ndc: w.ndc,
    author: w.authorName,
  };
}

/**
 * GET /api/works
 *
 * - ?author_id=879       作者IDで絞り込み
 * - ?kana_prefix=ハ      作品名読みの50音行で絞り込み
 * - ?ndc=913             NDC番号で絞り込み
 * - ?sort=newest&limit=N 新着順取得（limitのデフォルト: 20）
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (handleCors(req, res)) return;

  const { author_id, kana_prefix, ndc, sort, limit } = req.query;

  const hasAuthorId = author_id !== undefined;
  const hasKanaPrefix = kana_prefix !== undefined;
  const hasNdc = ndc !== undefined;
  const hasSort = sort === "newest";

  if (!hasAuthorId && !hasKanaPrefix && !hasNdc && !hasSort) {
    const error: ApiError = {
      error: "BadRequest",
      message:
        "author_id, kana_prefix, ndc, sort=newest のいずれかのパラメータが必要です",
    };
    res.status(400).json(error);
    return;
  }

  try {
    const index = await getIndex();
    let works;

    if (hasAuthorId) {
      const id = parseInt(String(author_id), 10);
      if (isNaN(id)) {
        const error: ApiError = {
          error: "BadRequest",
          message: "author_id は整数で指定してください",
        };
        res.status(400).json(error);
        return;
      }
      works = index.getWorksByAuthorId(id);
    } else if (hasKanaPrefix) {
      works = index.getWorksByTitleKanaPrefix(String(kana_prefix));
    } else if (hasNdc) {
      works = index.getWorksByNdc(String(ndc));
    } else {
      // sort=newest
      const limitNum = limit !== undefined ? parseInt(String(limit), 10) : 20;
      const safeLimit = isNaN(limitNum) || limitNum <= 0 ? 20 : limitNum;
      works = index.getNewestWorks(safeLimit);
    }

    // ページネーション
    const offsetNum = req.query.offset !== undefined ? parseInt(String(req.query.offset), 10) : 0;
    const limitNum2 = req.query.limit !== undefined ? parseInt(String(req.query.limit), 10) : 50;
    const safeOffset = isNaN(offsetNum) || offsetNum < 0 ? 0 : offsetNum;
    const safeLimit2 = isNaN(limitNum2) || limitNum2 <= 0 ? 50 : Math.min(limitNum2, 200);

    const total = works.length;
    const paged = works.slice(safeOffset, safeOffset + safeLimit2);

    const body = {
      works: paged.map(toWorkItem),
      total,
      offset: safeOffset,
      limit: safeLimit2,
    };
    res.status(200).json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error: ApiError = {
      error: "InternalServerError",
      message,
    };
    res.status(500).json(error);
  }
}
