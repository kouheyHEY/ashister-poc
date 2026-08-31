# アシスター

欲しいものを覚え、ひとつずつ叶えるためのキャラクター型アシスタントです。スマートフォンの一画面で扱えることを優先し、ホームではキャラクターとの短いやり取り、左右のタブでは欲しいもの一覧と履歴付きチャットを使えます。

## 初版でできること

- メールアドレスによるユーザー登録、ログイン、ログアウト
- メール確認とパスワード再設定
- ユーザーごとに分離した欲しいものデータのクラウド保存
- 欲しいものの追加、優先度設定、購入済み・保留・手放した状態への変更、削除
- 欲しい数、購入数、実現率の自動計算
- ホームとチャットからの会話形式の操作
- データを変更する前の確認
- 片手操作を想定した大きな操作ボタンと下部ナビ
- 一覧の絞り込み、ページ送り、左右スワイプ

会話はAI APIを使用せず、想定された日本語入力をルールで判定します。入力の自由度を広げるAI対応は次段階の機能です。

## 技術構成

- Vite + React + TypeScript
- TanStack Query
- Netlify Identity (`@netlify/identity`)
- Netlify Functions
- Netlify Blobs
- Vitest

Next.jsや常時稼働する独自サーバーは使っていません。画面は静的配信し、認証が必要な保存処理だけをNetlify Functionsで実行します。

## ローカルで確認する

```sh
npm install
npm run dev
```

ローカルの画面は `http://localhost:5173` で開きます。Netlify IdentityとFunctionsを含む動作確認には、Netlifyのプレビューまたは本番環境を使用してください。

```sh
npm test
npm run build
```

## データと安全性

- APIはNetlify Identityのアクセストークンをサーバー側で検証します。
- 保存先はユーザーIDごとに分離したNetlify Blobsです。
- 未ログインのAPIアクセスは拒否されます。
- 実現率は `購入済み ÷（欲しい + 購入済み）` で計算し、保留・手放した項目は対象外です。
- ユーザー登録はメールアドレスの確認を必須にしています。

## 公開先

- アプリ: https://ashister-app.netlify.app
- ソースコード: https://github.com/kouheyHEY/ashister-poc
