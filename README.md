# 2DGS

3DGS勉強用に2D画像近似を行うアプリ

\## Usage

本リポジトリをクローン後、コンテナビルド＆起動

```

$ cd 2DGS

$ docker-compose up --build

$ docker-compose up -d

```

起動後、ブラウザで http://localhost:3000 へアクセス。



\## 構成

root/

├─ frontend/			# ✅フロントエンド一式(react)

│ └─ app/

│   └─ src/

│     └─ App.jsx	# メイン処理

├── backend/		# ✅バックエンド一式(python)

│ └─ src/

│   └─ main.py	# メイン処理

├── testdata/				# ✅テストデータ（png画像）

└── docker-compose.yml



