import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getIndex } from "../lib/index-loader.js";
import type { AuthorsResponse, ApiError } from "../lib/types.js";

/**
 * GET /api/authors?kana_prefix=ア
 *
 * 指定した50音行（例: ア, カ, サ ...）に属する作者一覧を返す。
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { kana_prefix } = req.query;

  if (!kana_prefix || typeof kana_prefix !== "string") {
    const error: ApiError = {
      error: "BadRequest",
      message: "クエリパラメータ kana_prefix が必要です（例: ?kana_prefix=ア）",
    };
    res.status(400).json(error);
    return;
  }

  try {
    const index = await getIndex();
    const authors = index.getAuthorsByKanaPrefix(kana_prefix);

    const body: AuthorsResponse = {
      authors: authors.map((a) => ({
        id: a.id,
        name: a.name,
        kana: a.kana,
        work_count: a.workCount,
      })),
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
