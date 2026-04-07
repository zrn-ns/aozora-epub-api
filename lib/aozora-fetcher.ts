import AdmZip from "adm-zip";
import iconv from "iconv-lite";

/**
 * 青空文庫のZIPファイルURLからテキストを取得し、UTF-8文字列で返す。
 *
 * @param zipUrl - 青空文庫テキストZIPのURL（例: https://www.aozora.gr.jp/cards/000879/files/127_ruby_150.zip）
 * @returns UTF-8デコード済みのテキスト文字列
 */
export async function fetchAozoraText(zipUrl: string): Promise<string> {
  // 1. ZIP をフェッチ
  const response = await fetch(zipUrl);
  if (!response.ok) {
    throw new Error(
      `青空文庫テキストの取得に失敗しました: ${response.status} ${response.statusText} (${zipUrl})`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 2. ZIP を展開して .txt ファイルを取り出す
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const txtEntry = entries.find((e) => e.entryName.endsWith(".txt"));
  if (!txtEntry) {
    throw new Error(`ZIPアーカイブ内にテキストファイルが見つかりません: ${zipUrl}`);
  }
  const rawBuffer = txtEntry.getData();

  // 3. Shift_JIS → UTF-8 デコード
  const text = iconv.decode(rawBuffer, "Shift_JIS");

  return text;
}
