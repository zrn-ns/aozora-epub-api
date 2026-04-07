import type { AozoraNode, Chapter } from "./types.js";

/**
 * AozoraNode[]を見出し・改ページで章分割する
 */
export function splitChapters(nodes: AozoraNode[]): Chapter[] {
  const chapters: Chapter[] = [];
  let currentTitle = "";
  let currentNodes: AozoraNode[] = [];

  for (const node of nodes) {
    if (node.type === "heading") {
      // 見出し: 現在の章を確定して新しい章を開始
      const chapter: Chapter = { title: currentTitle, nodes: currentNodes };
      chapters.push(chapter);
      currentTitle = extractHeadingText(node.children);
      currentNodes = [];
    } else if (node.type === "pagebreak") {
      // 改ページ: 現在の章を確定して無題の新しい章を開始
      const chapter: Chapter = { title: currentTitle, nodes: currentNodes };
      chapters.push(chapter);
      currentTitle = "";
      currentNodes = [];
    } else {
      currentNodes.push(node);
    }
  }

  // 最後の章を追加
  chapters.push({ title: currentTitle, nodes: currentNodes });

  // 空の序文チャプターを除外（タイトルが空かつ意味あるテキストノードがない）
  return chapters.filter((ch) => {
    if (ch.title !== "") return true;
    return hasMeaningfulContent(ch.nodes);
  });
}

/**
 * heading の children からテキストを抽出する
 */
function extractHeadingText(children: AozoraNode[]): string {
  return children
    .map((node) => {
      if (node.type === "text") return node.content;
      if (node.type === "ruby") return node.base;
      if (
        node.type === "emphasis" ||
        node.type === "indent" ||
        node.type === "heading"
      ) {
        return extractHeadingText(node.children);
      }
      return "";
    })
    .join("");
}

/**
 * ノード群に意味あるテキストコンテンツが含まれるか判定する
 * newline のみは意味なし扱い
 */
function hasMeaningfulContent(nodes: AozoraNode[]): boolean {
  return nodes.some(
    (n) =>
      n.type === "text" ||
      n.type === "ruby" ||
      n.type === "emphasis" ||
      n.type === "indent" ||
      n.type === "pagebreak"
  );
}
