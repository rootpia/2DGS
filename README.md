# 2DGS
3DGS勉強用に2D画像近似を行うアプリ

## Usage
本リポジトリをクローン後、コンテナビルド＆起動
```
$ cd 2DGS
$ docker-compose up --build
$ docker-compose up -d
```

起動後、ブラウザで http://localhost:3000 へアクセス。

## 構成
root/
├─ frontend/ 
│ └─ app/
│   └─ src/
│     └─ App.jsx    # メイン画面
├── backend/
│ └─ src/
│   └─ main.py      # メイン処理
├── testdata/       # テストデータ（png画像）
│ └─ init_param/    # 初期パラメタサンプル
├── dev/
│ └─ docker-compose.yml    # 開発環境コンテナ起動用
└── docker-compose.yml     # アプリ起動用

## 技術スタック
* JavaScript
    Webページの動作を実現するスクリプト言語
    https://developer.mozilla.org/ja/docs/Web/JavaScript

* React
    UIを構築するためのJavaScriptライブラリ。
    コンポーネントの組合せでUIを作る。
    https://ja.react.dev/
    https://create-react-app.dev/docs/getting-started/

* Tailwind CSS
    ユーティリティファースト設計を実現するCSSフレームワーク。
    クラス名を書けばスタイル適用できる。
    https://tailwindcss.com/

* Python
    * pytorch
        DeepLearningフレームワーク。
        GPU利用、テンソル計算ができる。
        https://pytorch.org/

    * FastAPI
        Web APIフレームワーク。
        APIのスキーマ定義が簡単にできる。
        https://fastapi.tiangolo.com/ja/

* docker
    環境のパッケージング（コンテナ）技術
    https://docs.docker.com/
