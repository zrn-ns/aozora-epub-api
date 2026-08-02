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
  /** 副題（例: "001 金色の処女"）。無い場合は空文字 */
  subtitle: string;
  titleKana: string;
  authorId: number;
  authorName: string;
  ndc: string;
  textUrl: string;
  publishedDate: string;
  /** 文字遣い種別（例: "新字新仮名", "旧字旧仮名"） */
  variant: string;
}

/** 青空文庫注記パーサーの出力ノード */
export type AozoraNode =
  | { type: "text"; content: string }
  | { type: "ruby"; base: string; reading: string }
  | { type: "heading"; level: 1 | 2 | 3; children: AozoraNode[] }
  | { type: "heading_end"; level: 1 | 2 | 3 }
  | { type: "indent"; chars: number; children: AozoraNode[] }
  | { type: "emphasis"; style: "sesame" | "circle"; children: AozoraNode[] }
  | { type: "paragraph"; children: AozoraNode[] }
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
    /** 副題。同一タイトルの分冊・連作を区別するために返す（無い場合は空文字） */
    subtitle: string;
    kana: string;
    ndc: string;
    author: string;
    /** 文字遣い種別（例: "新字新仮名"）。同一タイトルの版違いを区別するために返す */
    variant: string;
  }>;
  total: number;
  offset: number;
  limit: number;
}
