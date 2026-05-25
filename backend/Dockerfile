FROM python:3.11.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip \
    && pip install -r /tmp/requirements.txt

COPY . /app/PV_Generator/backend

# Runtime compatibility for modules expecting package paths without spaces.
RUN mkdir -p /app/PV_Generator/backend/routes /app/PV_Generator/backend/models \
    && cp -r "/app/PV_Generator/backend/routes layer/." /app/PV_Generator/backend/routes/ \
    && cp -r "/app/PV_Generator/backend/models layer/." /app/PV_Generator/backend/models/

WORKDIR /app/PV_Generator/backend
ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]