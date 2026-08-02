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

  private constructor(
    works: Work[],
    authors: Map<number, Author>,
    /**
     * 人物ID → その人物が関与する作品IDの集合。
     * 著者・翻訳者・校訂者などの役割を問わず全て含む。
     */
    workIdsByPersonId: Map<number, Set<number>>
  ) {
    this.works = works;
    this.authors = authors;
    this.worksByAuthorId = new Map();
    this.worksById = new Map();

    for (const work of works) {
      this.worksById.set(work.id, work);
    }

    for (const [personId, workIds] of workIdsByPersonId) {
      const list: Work[] = [];
      for (const workId of workIds) {
        const work = this.worksById.get(workId);
        if (work) list.push(work);
      }
      this.worksByAuthorId.set(personId, list);
    }
  }

  static fromCsv(csvContent: string): AozoraIndex {
    const lines = csvContent.split(/\r?\n/);
    if (lines.length < 2) return new AozoraIndex([], new Map(), new Map());

    // ヘッダ行からカラムインデックスを動的に構築
    const headerFields = parseCsvLine(lines[0]);
    const colIdx = buildColumnIndex(headerFields);

    const C_WORK_ID = colIdx["作品ID"] ?? 0;
    const C_TITLE = colIdx["作品名"] ?? 1;
    const C_TITLE_KANA = colIdx["作品名読み"] ?? 2;
    const C_SUBTITLE = colIdx["副題"] ?? 4;
    const C_NDC = colIdx["分類番号"] ?? 8;
    const C_VARIANT = colIdx["文字遣い種別"] ?? 9;
    const C_WORK_COPYRIGHT = colIdx["作品著作権フラグ"] ?? 10;
    const C_PUBLISHED_DATE = colIdx["公開日"] ?? 11;
    const C_PERSON_ID = colIdx["人物ID"] ?? 13;
    const C_LAST_NAME = colIdx["姓"] ?? 14;
    const C_FIRST_NAME = colIdx["名"] ?? 15;
    const C_LAST_NAME_KANA = colIdx["姓読み"] ?? 16;
    const C_ROLE = colIdx["役割フラグ"] ?? 22;
    const C_TEXT_URL = colIdx["テキストファイルURL"] ?? 42;

    const dataLines = lines.slice(1).filter((l) => l.trim() !== "");

    // CSVは「1作品1行」ではなく「1作品の関係者ごとに1行」なので、
    // 作品情報の元にする行を作品IDごとに1つ選ぶ。翻訳者の行が著者の行より
    // 先に現れることもあるため、役割フラグが「著者」の行を優先する。
    const workFields = new Map<number, string[]>();
    const workRoles = new Map<number, string>();
    // 人物ID → その人物が関与する作品IDの集合（役割は問わない）
    const workIdsByPersonId = new Map<number, Set<number>>();
    // authorId → { 姓, 名, 姓読み } の一時マップ
    const authorRaw = new Map<
      number,
      { lastName: string; firstName: string; lastNameKana: string }
    >();

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

      // 作品情報の元にする行を決める（「著者」の行が最優先、無ければ先着）
      // 共著作品は先着の著者1名を代表として扱う（作品自体は下の紐付けで
      // 全共著者の一覧に出る）
      const role = fields[C_ROLE].trim();
      const currentRole = workRoles.get(workId);
      if (currentRole === undefined || (currentRole !== "著者" && role === "著者")) {
        workFields.set(workId, fields);
        workRoles.set(workId, role);
      }

      // 役割を問わず全ての関係者を作品に紐付ける
      // （こうしないと翻訳者や共著者の作品一覧が空になる）
      let workIds = workIdsByPersonId.get(authorId);
      if (!workIds) {
        workIds = new Set();
        workIdsByPersonId.set(authorId, workIds);
      }
      workIds.add(workId);

      // 作者情報を収集（同一IDの先着を使用）
      if (!authorRaw.has(authorId)) {
        authorRaw.set(authorId, {
          lastName: fields[C_LAST_NAME].trim(),
          firstName: fields[C_FIRST_NAME].trim(),
          lastNameKana: fields[C_LAST_NAME_KANA].trim(),
        });
      }
    }

    // 選ばれた行から Work を構築する
    const works: Work[] = [];
    for (const [workId, fields] of workFields) {
      // NDC: "NDC 913" → "913"
      const ndcRaw = fields[C_NDC].trim();
      const ndcMatch = ndcRaw.match(/NDC\s+(\S+)/);
      const ndc = ndcMatch ? ndcMatch[1] : ndcRaw;

      works.push({
        id: workId,
        title: fields[C_TITLE].trim(),
        subtitle: fields[C_SUBTITLE].trim(),
        titleKana: fields[C_TITLE_KANA].trim(),
        authorId: parseInt(fields[C_PERSON_ID], 10),
        authorName: `${fields[C_LAST_NAME].trim()}${fields[C_FIRST_NAME].trim()}`,
        ndc,
        textUrl: fields[C_TEXT_URL].trim(),
        publishedDate: fields[C_PUBLISHED_DATE].trim(),
        variant: fields[C_VARIANT].trim(),
      });
    }

    // Author マップを構築（作品数は関与作品の数で数える）
    const authors = new Map<number, Author>();
    for (const [id, raw] of authorRaw) {
      authors.set(id, {
        id,
        name: `${raw.lastName}${raw.firstName}`,
        kana: raw.lastNameKana,
        workCount: workIdsByPersonId.get(id)?.size ?? 0,
      });
    }

    return new AozoraIndex(works, authors, workIdsByPersonId);
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
