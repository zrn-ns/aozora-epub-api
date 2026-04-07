import archiver from "archiver";
import { PassThrough } from "stream";
import type { AozoraNode, Chapter } from "./types.js";

/**
 * AozoraNodeの配列をXHTML文字列に変換する
 */
function nodesToXhtml(nodes: AozoraNode[]): string {
  let result = "";
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        result += escapeXml(node.content);
        break;
      case "ruby":
        result += `<ruby>${escapeXml(node.base)}<rt>${escapeXml(node.reading)}</rt></ruby>`;
        break;
      case "heading":
        result += `<h${node.level}>${nodesToXhtml(node.children)}</h${node.level}>`;
        break;
      case "heading_end":
        // heading_end は heading ノードに内包されているため個別処理不要
        break;
      case "indent":
        result += `<p style="text-indent: ${node.chars}em">${nodesToXhtml(node.children)}</p>`;
        break;
      case "emphasis":
        result += `<em class="${node.style}">${nodesToXhtml(node.children)}</em>`;
        break;
      case "pagebreak":
        // ページブレークはチャプター分割済みのためスキップ
        break;
      case "newline":
        result += "<br/>\n";
        break;
    }
  }
  return result;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildChapterXhtml(title: string, nodes: AozoraNode[]): string {
  const body = nodesToXhtml(nodes);
  const titleEscaped = escapeXml(title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${titleEscaped}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${title ? `<h1>${titleEscaped}</h1>\n` : ""}${body}
</body>
</html>`;
}

function buildContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function buildContentOpf(title: string, author: string, chapters: Chapter[]): string {
  const titleEscaped = escapeXml(title);
  const authorEscaped = escapeXml(author);

  const manifestItems = chapters
    .map(
      (_, i) =>
        `    <item id="chapter_${String(i + 1).padStart(3, "0")}" href="chapter_${String(i + 1).padStart(3, "0")}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join("\n");

  const spineItems = chapters
    .map(
      (_, i) =>
        `    <itemref idref="chapter_${String(i + 1).padStart(3, "0")}"/>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="ja">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:aozora-epub</dc:identifier>
    <dc:title>${titleEscaped}</dc:title>
    <dc:creator>${authorEscaped}</dc:creator>
    <dc:language>ja</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine page-progression-direction="rtl">
    <itemref idref="nav" linear="no"/>
${spineItems}
  </spine>
</package>`;
}

function buildNavXhtml(title: string, chapters: Chapter[]): string {
  const titleEscaped = escapeXml(title);
  const tocItems = chapters
    .map(
      (ch, i) =>
        `      <li><a href="chapter_${String(i + 1).padStart(3, "0")}.xhtml">${escapeXml(ch.title)}</a></li>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${titleEscaped}</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>${titleEscaped}</h1>
    <ol>
${tocItems}
    </ol>
  </nav>
</body>
</html>`;
}

function buildStyleCss(): string {
  return `/* CrossPoint EPUB Style */
html {
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
}

ruby rt {
  font-size: 0.5em;
}

em.sesame {
  font-style: normal;
  text-emphasis: sesame;
  -webkit-text-emphasis: sesame;
}

em.circle {
  font-style: normal;
  text-emphasis: circle;
  -webkit-text-emphasis: circle;
}

p[style*="text-indent"] {
  margin: 0;
  padding: 0;
}
`;
}

/**
 * EPUB3形式のZIPバッファを生成する
 */
export async function buildEpub(options: {
  title: string;
  author: string;
  chapters: Chapter[];
}): Promise<Buffer> {
  const { title, author, chapters } = options;

  return new Promise<Buffer>((resolve, reject) => {
    const passThrough = new PassThrough();
    const chunks: Buffer[] = [];

    passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.pipe(passThrough);

    // mimetypeはEPUB仕様により最初のエントリ・非圧縮必須
    archive.append("application/epub+zip", {
      name: "mimetype",
      store: true,
    } as archiver.ZipEntryData);

    // META-INF/container.xml
    archive.append(buildContainerXml(), { name: "META-INF/container.xml" });

    // OEBPS/content.opf
    archive.append(buildContentOpf(title, author, chapters), {
      name: "OEBPS/content.opf",
    });

    // OEBPS/nav.xhtml
    archive.append(buildNavXhtml(title, chapters), {
      name: "OEBPS/nav.xhtml",
    });

    // OEBPS/style.css
    archive.append(buildStyleCss(), { name: "OEBPS/style.css" });

    // OEBPS/chapter_NNN.xhtml
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const filename = `chapter_${String(i + 1).padStart(3, "0")}.xhtml`;
      archive.append(buildChapterXhtml(chapter.title, chapter.nodes), {
        name: `OEBPS/${filename}`,
      });
    }

    archive.finalize();
  });
}
