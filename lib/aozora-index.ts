import type { Author, Work } from "./types.js";

/** ひらがなをカタカナに変換 */
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

/** 50音行の先頭カタカナ → 同じ行に属するカタカナ一覧 */
const KANA_ROW_MAP: Record<string, string[]> = {
  ア: ["ア", "イ", "ウ", "エ", "オ"],
  カ: ["カ", "キ", "ク", "ケ", "コ", "ガ", "ギ", "グ", "ゲ", "ゴ"],
  サ: ["サ", "シ", "ス", "セ", "ソ", "ザ", "ジ", "ズ", "ゼ", "ゾ"],
  タ: ["タ", "チ", "ツ", "テ", "ト", "ダ", "ヂ", "ヅ", "デ", "ド"],
  ナ: ["ナ", "ニ", "ヌ", "ネ", "ノ"],
  ハ: ["ハ", "ヒ", "フ", "ヘ", "ホ", "バ", "ビ", "ブ", "ベ", "ボ", "パ", "ピ", "プ", "ペ", "ポ"],
  マ: ["マ", "ミ", "ム", "メ", "モ"],
  ヤ: ["ヤ", "ユ", "ヨ"],
  ラ: ["ラ", "リ", "ル", "レ", "ロ"],
  ワ: ["ワ", "ヲ", "ン"],
};

/** CSVの1行をフィールド配列に分割（クォート対応） */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        // ダブルクォートのエスケープ確認
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/** ヘッダ名 → 列インデックスのマップを構築する */
function buildColumnIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    map[headers[i].trim()] = i;
  }
  return map;
}

export class AozoraIndex {
  private works: Work[];
  private authors: Map<number, Author>;
  /** 作者ID → 作品リスト */
  private worksByAuthorId: Map<number, Work[]>;
  /** 作品ID → 作品 */
  private worksById: Map<number, Work>;

  private constructor(works: Work[], authors: Map<number, Author>) {
    this.works = works;
    this.authors = authors;
    this.worksByAuthorId = new Map();
    this.worksById = new Map();

    for (const work of works) {
      this.worksById.set(work.id, work);
      if (!this.worksByAuthorId.has(work.authorId)) {
        this.worksByAuthorId.set(work.authorId, []);
      }
      this.worksByAuthorId.get(work.authorId)!.push(work);
    }
  }

  static fromCsv(csvContent: string): AozoraIndex {
    const lines = csvContent.split(/\r?\n/);
    if (lines.length < 2) return new AozoraIndex([], new Map());

    // ヘッダ行からカラムインデックスを動的に構築
    const headerFields = parseCsvLine(lines[0]);
    const colIdx = buildColumnIndex(headerFields);

    const C_WORK_ID = colIdx["作品ID"] ?? 0;
    const C_TITLE = colIdx["作品名"] ?? 1;
    const C_TITLE_KANA = colIdx["作品名読み"] ?? 2;
    const C_NDC = colIdx["分類番号"] ?? 8;
    const C_WORK_COPYRIGHT = colIdx["作品著作権フラグ"] ?? 10;
    const C_PUBLISHED_DATE = colIdx["公開日"] ?? 11;
    const C_PERSON_ID = colIdx["人物ID"] ?? 13;
    const C_LAST_NAME = colIdx["姓"] ?? 14;
    const C_FIRST_NAME = colIdx["名"] ?? 15;
    const C_LAST_NAME_KANA = colIdx["姓読み"] ?? 16;
    const C_TEXT_URL = colIdx["テキストファイルURL"] ?? 42;

    const dataLines = lines.slice(1).filter((l) => l.trim() !== "");

    const worksMap = new Map<number, Work>();
    // authorId → { 姓, 名, 姓読み } の一時マップ
    const authorRaw = new Map<
      number,
      { lastName: string; firstName: string; lastNameKana: string }
    >();
    // authorId → 作品数カウント
    const authorWorkCount = new Map<number, number>();

    for (const line of dataLines) {
      const fields = parseCsvLine(line);
      if (fields.length < C_TEXT_URL + 1) continue;

      // 著作権あり or テキストURLなし はスキップ
      const copyright = fields[C_WORK_COPYRIGHT].trim();
      const textUrl = fields[C_TEXT_URL].trim();
      if (copyright === "あり" || textUrl === "") continue;

      const workId = parseInt(fields[C_WORK_ID], 10);
      if (isNaN(workId)) continue;

      const authorId = parseInt(fields[C_PERSON_ID], 10);
      if (isNaN(authorId)) continue;

      // NDC: "NDC 913" → "913"
      const ndcRaw = fields[C_NDC].trim();
      const ndcMatch = ndcRaw.match(/NDC\s+(\S+)/);
      const ndc = ndcMatch ? ndcMatch[1] : ndcRaw;

      const work: Work = {
        id: workId,
        title: fields[C_TITLE].trim(),
        titleKana: fields[C_TITLE_KANA].trim(),
        authorId,
        authorName: `${fields[C_LAST_NAME].trim()}${fields[C_FIRST_NAME].trim()}`,
        ndc,
        textUrl,
        publishedDate: fields[C_PUBLISHED_DATE].trim(),
      };

      // 同じ作品IDの重複行は最初のもので確定（通常は1作品=1行）
      if (!worksMap.has(workId)) {
        worksMap.set(workId, work);
      }

      // 作者情報を収集（同一IDの先着を使用）
      if (!authorRaw.has(authorId)) {
        authorRaw.set(authorId, {
          lastName: fields[C_LAST_NAME].trim(),
          firstName: fields[C_FIRST_NAME].trim(),
          lastNameKana: fields[C_LAST_NAME_KANA].trim(),
        });
      }
    }

    // worksMap からリストを作成し、作者ごとの作品数を集計
    const works: Work[] = Array.from(worksMap.values());
    for (const work of works) {
      authorWorkCount.set(
        work.authorId,
        (authorWorkCount.get(work.authorId) ?? 0) + 1
      );
    }

    // Author マップを構築
    const authors = new Map<number, Author>();
    for (const [id, raw] of authorRaw) {
      authors.set(id, {
        id,
        name: `${raw.lastName}${raw.firstName}`,
        kana: raw.lastNameKana,
        workCount: authorWorkCount.get(id) ?? 0,
      });
    }

    return new AozoraIndex(works, authors);
  }

  /**
   * 指定した50音行（例: "ア", "カ", ...）に属する作家を返す。
   * 姓読み（ひらがな）の先頭文字をカタカナに変換して判定する。
   * 結果は姓読みの昇順でソートする。
   */
  getAuthorsByKanaPrefix(prefix: string): Author[] {
    const katakanaPrefix = hiraganaToKatakana(prefix);
    const row = KANA_ROW_MAP[katakanaPrefix];

    // 行キー（ア,カ,サ...）なら行全体、個別文字ならその文字のみ
    const rowSet = row ? new Set(row) : new Set([katakanaPrefix]);
    const result: Author[] = [];

    for (const author of this.authors.values()) {
      const kana = hiraganaToKatakana(author.kana);
      const firstChar = kana.charAt(0);
      if (rowSet.has(firstChar)) {
        result.push(author);
      }
    }

    // 姓読みの昇順でソート
    result.sort((a, b) => a.kana.localeCompare(b.kana, "ja"));
    return result;
  }

  /** 作者IDに紐づく作品一覧を返す */
  getWorksByAuthorId(authorId: number): Work[] {
    return this.worksByAuthorId.get(authorId) ?? [];
  }

  /**
   * 作品名読みの先頭文字が指定した50音行に属する作品を返す。
   * 「ハ」を指定した場合 は ハ行（ハヒフヘホ + 濁音・半濁音）にマッチする。
   */
  getWorksByTitleKanaPrefix(prefix: string): Work[] {
    const katakanaPrefix = hiraganaToKatakana(prefix);
    const row = KANA_ROW_MAP[katakanaPrefix];

    // 行キー（ア,カ,サ...）なら行全体、個別文字ならその文字のみ
    const rowSet = row ? new Set(row) : new Set([katakanaPrefix]);
    return this.works.filter((w) => {
      const kana = hiraganaToKatakana(w.titleKana);
      return rowSet.has(kana.charAt(0));
    });
  }

  /** NDC番号で作品を絞り込む（例: "913"） */
  getWorksByNdc(ndc: string): Work[] {
    return this.works.filter((w) => w.ndc === ndc);
  }

  /** 公開日の新しい順でlimit件取得する */
  getNewestWorks(limit: number): Work[] {
    return [...this.works]
      .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
      .slice(0, limit);
  }

  /** 作品IDで1件取得、存在しない場合はnullを返す */
  getWorkById(workId: number): Work | null {
    return this.worksById.get(workId) ?? null;
  }
}
