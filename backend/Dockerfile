FROM python:3.11.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install system deps
#RUN apt-get update \
 #   && apt-get install -y --no-install-recommends tesseract-ocr \
  #  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
# Install build tools pour llama-cpp-python
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    cmake \
    && rm -rf /var/lib/apt/lists/*
# Copy requirements first
COPY requirements.txt .
#COPY modeles/smolvlm-base /app/modeles/smolvlm-base
#COPY modeles/smolvlm-graphes-v2 /app/modeles/smolvlm-graphes-v2

# Install python deps
RUN pip install --no-cache-dir -r requirements.txt  # caché tant que requirements.txt ne change pas
RUN pip install --no-cache-dir torch==2.3.1+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir torchvision==0.18.1+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu
RUN pip install peft>=0.14.0

    COPY . /app/backend

ENV PYTHONPATH=/app/backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]