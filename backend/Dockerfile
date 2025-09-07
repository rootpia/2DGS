FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime

# システムパッケージのインストール
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Python依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションをコピー
COPY ./src/* /app

EXPOSE 18000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "18000", "--reload"]
