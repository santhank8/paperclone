FROM python:3.13-slim

RUN pip install --no-cache-dir "mempalace>=0.3,<1" "starlette>=0.40,<1" "uvicorn>=0.30,<1"

RUN useradd -r -m -s /usr/sbin/nologin mempalace
COPY serve_http.py /app/serve_http.py

ENV MEMPALACE_PALACE_PATH=/data/mempalace
ENV MEMPALACE_PORT=8080
EXPOSE 8080

VOLUME ["/data/mempalace"]
RUN mkdir -p /data/mempalace && chown mempalace:mempalace /data/mempalace

USER mempalace

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["python", "/app/serve_http.py"]
