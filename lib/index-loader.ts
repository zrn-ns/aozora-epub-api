import AdmZip from "adm-zip";
import { AozoraIndex } from "./aozora-index.js";

const AOZORA_CSV_URL =
  "https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip";

let cachedIndex: AozoraIndex | null = null;

/**
 * 青空文庫CSVインデックスをフェッチ・解凍・パースしてキャッシュする。
 * 2回目以降の呼び出しはキャッシュを返す。
 */
export async function getIndex(): Promise<AozoraIndex> {
  if (cachedIndex) return cachedIndex;

  // 1. ZIP をフェッチ
  const response = await fetch(AOZORA_CSV_URL);
  if (!response.ok) {
    throw new Error(
      `青空文庫インデックスの取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 2. ZIP を展開して CSV を取り出す
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const csvEntry = entries.find((e) => e.entryName.endsWith(".csv"));
  if (!csvEntry) {
    throw new Error("ZIPアーカイブ内にCSVファイルが見つかりません");
  }
  const csvContent = csvEntry.getData().toString("utf8");

  // 3. AozoraIndex にパース
  const index = AozoraIndex.fromCsv(csvContent);

  // 4. キャッシュして返す
  cachedIndex = index;
  return index;
}

/**
 * テスト用: キャッシュをリセットする
 */
export function resetIndexCache(): void {
  cachedIndex = null;
}
