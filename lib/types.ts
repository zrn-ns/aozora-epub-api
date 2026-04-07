/** CSVインデックスから読み込んだ作家情報 */
export interface Author {
  id: number;
  name: string;
  kana: string;
  workCount: number;
}

/** CSVインデックスから読み込んだ作品情報 */
export interface Work {
  id: number;
  title: string;
  titleKana: string;
  authorId: number;
  authorName: string;
  ndc: string;
  textUrl: string;
  publishedDate: string;
}

/** 青空文庫注記パーサーの出力ノード */
export type AozoraNode =
  | { type: "text"; content: string }
  | { type: "ruby"; base: string; reading: string }
  | { type: "heading"; level: 1 | 2 | 3; children: AozoraNode[] }
  | { type: "heading_end"; level: 1 | 2 | 3 }
  | { type: "indent"; chars: number; children: AozoraNode[] }
  | { type: "emphasis"; style: "sesame" | "circle"; children: AozoraNode[] }
  | { type: "pagebreak" }
  | { type: "newline" };

/** 章分割後のチャプター */
export interface Chapter {
  title: string;
  nodes: AozoraNode[];
}

/** APIエラーレスポンス */
export interface ApiError {
  error: string;
  message: string;
}

/** /api/authors レスポンス */
export interface AuthorsResponse {
  authors: Array<{
    id: number;
    name: string;
    kana: string;
    work_count: number;
  }>;
}

/** /api/works レスポンス */
export interface WorksResponse {
  works: Array<{
    id: number;
    title: string;
    kana: string;
    ndc: string;
  }>;
}
