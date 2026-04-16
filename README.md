# aozora-epub-api

青空文庫の作品をEPUB形式に変換するWeb API。

## 概要

[青空文庫](https://www.aozora.gr.jp/)に収録されている作品を、電子書籍リーダーで読めるEPUB形式に変換して提供します。

- 50音行による作者検索
- 作者ID・作品名読み・NDC分類による作品検索
- 作品のEPUBリアルタイム変換・ダウンロード

**本番URL**: https://aozora-epub-api.vercel.app

## APIエンドポイント

### `GET /api/authors`

50音行で作者を検索します。

| パラメータ | 必須 | 説明 | 例 |
|---|---|---|---|
| `kana_prefix` | Yes | 50音行の先頭カナ | `ア`, `カ`, `サ` ... |

```bash
curl "https://aozora-epub-api.vercel.app/api/authors?kana_prefix=ア"
```

```json
{
  "authors": [
    { "id": 879, "name": "芥川 龍之介", "kana": "アクタガワ リュウノスケ", "work_count": 371 }
  ]
}
```

### `GET /api/works`

作品を検索します。以下のいずれかのパラメータが必要です。

| パラメータ | 説明 | 例 |
|---|---|---|
| `author_id` | 作者IDで絞り込み | `879` |
| `kana_prefix` | 作品名読みの50音行で絞り込み | `ハ` |
| `ndc` | NDC分類番号で絞り込み | `913` |
| `sort=newest` | 新着順で取得 | - |

ページネーション:

| パラメータ | デフォルト | 最大 | 説明 |
|---|---|---|---|
| `offset` | `0` | - | 取得開始位置 |
| `limit` | `50` | `200` | 取得件数 |

```bash
curl "https://aozora-epub-api.vercel.app/api/works?author_id=879&limit=3"
```

```json
{
  "works": [
    { "id": 45, "title": "羅生門", "kana": "ラショウモン", "ndc": "913", "author": "芥川 龍之介" }
  ],
  "total": 371,
  "offset": 0,
  "limit": 3
}
```

### `GET /api/convert`

作品をEPUBに変換してダウンロードします。

| パラメータ | 必須 | 説明 | 例 |
|---|---|---|---|
| `work_id` | Yes | 作品ID | `45` |

```bash
curl -OJ "https://aozora-epub-api.vercel.app/api/convert?work_id=45"
```

レスポンス: `application/epub+zip` バイナリ

## EPUB変換の対応機能

- 章分割（見出しベース）
- ルビ（振り仮名）
- 傍点（圏点・白ゴマ）
- 字下げ
- 縦書き表示（vertical-rl）

## 開発

```bash
# 依存パッケージのインストール
npm install

# 開発サーバーの起動（Vercel CLI）
npm run dev

# テストの実行
npm test
```

### 技術スタック

- **ランタイム**: Node.js + TypeScript
- **ホスティング**: Vercel Serverless Functions
- **テスト**: Vitest
- **EPUB生成**: archiver
- **文字コード変換**: iconv-lite

## フロントエンド

`frontend/` ディレクトリにブラウザ用のフロントエンドがあります。GitHub Pagesでホストされています。

**フロントエンドURL**: https://zrn-ns.github.io/aozora-epub-api/

## ライセンス

青空文庫の作品データは各作品の著作権に従います。
