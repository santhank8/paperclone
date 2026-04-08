FROM python:3.13-slim

RUN pip install --no-cache-dir mempalace starlette

COPY serve_http.py /app/serve_http.py

ENV MEMPALACE_PALACE_PATH=/data/mempalace
ENV MEMPALACE_PORT=8080
EXPOSE 8080

VOLUME ["/data/mempalace"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["python", "/app/serve_http.py"]
