import type { AozoraNode } from "./types.js";

/**
 * 青空文庫注記テキストをAozoraNode[]にパースする
 */
export function parseAozoraText(text: string): AozoraNode[] {
  // 改行コードを統一
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Step 1: 記号説明ブロックを除去（-------で囲まれた【テキスト中に現れる記号について】を含むブロック）
  const withoutHeader = removeSymbolBlock(normalized);

  // Step 2: タイトル行を除去（最初の空行までの内容）
  const withoutTitle = removeTitleBlock(withoutHeader);

  // Step 3: 行ごとにパース
  return parseLines(withoutTitle);
}

/**
 * 【テキスト中に現れる記号について】を含む -------ブロック を除去する
 */
function removeSymbolBlock(text: string): string {
  // -------で始まる行から次の-------行までのブロックで、中に記号説明を含むものを除去
  const lines = text.split("\n");
  const result: string[] = [];
  let inBlock = false;
  let blockLines: string[] = [];

  for (const line of lines) {
    if (!inBlock && /^-{7,}/.test(line)) {
      // ブロック開始候補
      inBlock = true;
      blockLines = [line];
    } else if (inBlock) {
      blockLines.push(line);
      if (/^-{7,}/.test(line)) {
        // ブロック終了
        const blockContent = blockLines.join("\n");
        if (!blockContent.includes("【テキスト中に現れる記号について】")) {
          // 記号説明ブロックでなければ保持
          result.push(...blockLines);
        }
        inBlock = false;
        blockLines = [];
      }
    } else {
      result.push(line);
    }
  }

  // 未閉鎖のブロックがある場合は保持
  if (inBlock) {
    result.push(...blockLines);
  }

  return result.join("\n");
}

/**
 * タイトルブロック（最初の空行まで）を除去する
 */
function removeTitleBlock(text: string): string {
  const lines = text.split("\n");
  let firstBlankIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      firstBlankIndex = i;
      break;
    }
  }

  if (firstBlankIndex === -1) {
    // 空行がなければ全体がタイトル扱い
    return "";
  }

  return lines.slice(firstBlankIndex + 1).join("\n");
}

/**
 * テキストをパースしてAozoraNode[]を返す
 */
function parseLines(text: string): AozoraNode[] {
  const lines = text.split("\n");
  const nodes: AozoraNode[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      nodes.push({ type: "newline" });
      continue;
    }

    // 改ページ
    if (line.trim() === "［＃改ページ］") {
      nodes.push({ type: "pagebreak" });
      continue;
    }

    // 字下げ + 見出し複合パターン: ［＃N字下げ］text［＃「text」はXX見出し］
    // 全角数字（０-９）と半角数字（0-9）の両方に対応
    // 字下げは見出しの書式指定なので、見出しノードとしてのみ出力する
    const indentHeadingMatch = line.match(
      /^［＃([0-9０-９]+)字下げ］(.+)［＃「(.+)」は(大|中|小)見出し］$/
    );
    if (indentHeadingMatch) {
      const headingText = indentHeadingMatch[3];
      const level = headingLevelFromSize(indentHeadingMatch[4]);
      const headingChildren = parseInline(headingText);
      nodes.push({ type: "heading", level, children: headingChildren });
      continue;
    }

    // 字下げのみ: ［＃N字下げ］text
    const indentMatch = line.match(/^［＃([0-9０-９]+)字下げ］(.*)$/);
    if (indentMatch) {
      const indentChars = parseJapaneseNumber(indentMatch[1]);
      const rest = indentMatch[2];
      const children = parseInline(rest);
      nodes.push({ type: "indent", chars: indentChars, children });
      continue;
    }

    // 見出し: text［＃「text」はXX見出し］
    const headingMatch = line.match(/^(.*)［＃「(.+)」は(大|中|小)見出し］(.*)$/);
    if (headingMatch) {
      const headingText = headingMatch[2];
      const level = headingLevelFromSize(headingMatch[3]);
      const headingChildren = parseInline(headingText);
      nodes.push({ type: "heading", level, children: headingChildren });
      continue;
    }

    // 通常行: インラインパース
    const inlineNodes = parseInline(line);
    nodes.push(...inlineNodes);
  }

  return nodes;
}

/**
 * 全角・半角混在の数字文字列を整数に変換する
 */
function parseJapaneseNumber(s: string): number {
  // 全角数字を半角に変換
  const normalized = s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30)
  );
  return parseInt(normalized, 10);
}

/**
 * 見出しサイズ文字からlevelを返す
 */
function headingLevelFromSize(size: string): 1 | 2 | 3 {
  switch (size) {
    case "大":
      return 1;
    case "中":
      return 2;
    case "小":
      return 3;
    default:
      return 1;
  }
}

/**
 * 行内のインライン注記をパースする
 * - ルビ: 漢字《かんじ》
 * - 傍点: ［＃「text」に傍点］
 */
function parseInline(text: string): AozoraNode[] {
  const nodes: AozoraNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // ルビパターン: base《reading》
    // baseは漢字・々・〇・ヶ・カタカナ・ひらがなの1文字以上
    const rubyMatch = remaining.match(
      /^([\u4E00-\u9FFF\u3400-\u4DBF々〇ヶ\u30A0-\u30FF\u3040-\u309F]+)《([^》]+)》/
    );
    if (rubyMatch) {
      const before = "";
      if (before) {
        nodes.push({ type: "text", content: before });
      }
      nodes.push({ type: "ruby", base: rubyMatch[1], reading: rubyMatch[2] });
      remaining = remaining.slice(rubyMatch[0].length);
      continue;
    }

    // 傍点パターン: ［＃「text」に傍点］
    const emphasisMatch = remaining.match(/^［＃「([^」]+)」に傍点］/);
    if (emphasisMatch) {
      const emphText = emphasisMatch[1];
      nodes.push({
        type: "emphasis",
        style: "sesame",
        children: [{ type: "text", content: emphText }],
      });
      remaining = remaining.slice(emphasisMatch[0].length);
      continue;
    }

    // 丸傍点パターン: ［＃「text」に丸傍点］
    const circleEmphasisMatch = remaining.match(/^［＃「([^」]+)」に丸傍点］/);
    if (circleEmphasisMatch) {
      const emphText = circleEmphasisMatch[1];
      nodes.push({
        type: "emphasis",
        style: "circle",
        children: [{ type: "text", content: emphText }],
      });
      remaining = remaining.slice(circleEmphasisMatch[0].length);
      continue;
    }

    // その他の［＃...］注記はスキップ（または保持）
    const aozoraAnnotationMatch = remaining.match(/^［＃[^］]*］/);
    if (aozoraAnnotationMatch) {
      // 未対応の注記はスキップ
      remaining = remaining.slice(aozoraAnnotationMatch[0].length);
      continue;
    }

    // ルビの直前テキストを処理: 次のルビ候補やアノテーションまでのテキスト
    // ルビベースになりうる文字の直前まで取得
    const nextSpecialIndex = findNextSpecial(remaining);
    if (nextSpecialIndex > 0) {
      nodes.push({ type: "text", content: remaining.slice(0, nextSpecialIndex) });
      remaining = remaining.slice(nextSpecialIndex);
    } else if (nextSpecialIndex === 0) {
      // 先頭がルビベース候補だが《がない場合、1文字進める
      nodes.push({ type: "text", content: remaining[0] });
      remaining = remaining.slice(1);
    } else {
      // 特殊文字なし、残り全てをテキストとして追加
      nodes.push({ type: "text", content: remaining });
      remaining = "";
    }
  }

  return nodes;
}

/**
 * 文字列中で次の特殊パターン（ルビ、注記）が始まる位置を返す。
 * 見つからない場合は -1 を返す。
 */
function findNextSpecial(text: string): number {
  // 《 を含む（ルビの読み仮名部分の開始）、または ［＃ を含む
  let minIndex = -1;

  // ルビベース: CJK漢字等 + 《 のパターンを探す
  const rubyPattern = /[\u4E00-\u9FFF\u3400-\u4DBF々〇ヶ\u30A0-\u30FF\u3040-\u309F]+《/;
  const rubyMatch = text.match(rubyPattern);
  if (rubyMatch && rubyMatch.index !== undefined) {
    const idx = rubyMatch.index;
    if (minIndex === -1 || idx < minIndex) {
      minIndex = idx;
    }
  }

  // ［＃ アノテーション
  const annoIdx = text.indexOf("［＃");
  if (annoIdx !== -1) {
    if (minIndex === -1 || annoIdx < minIndex) {
      minIndex = annoIdx;
    }
  }

  return minIndex;
}
