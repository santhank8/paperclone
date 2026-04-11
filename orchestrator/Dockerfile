# LangGraph Orchestrator — Agentic Squad
# Runs as a container alongside Paperclip
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/
COPY config/ config/
COPY agents/ agents/
COPY prompts/ prompts/

# Non-root
RUN useradd -m agent && chown -R agent:agent /app
USER agent

CMD ["python", "-m", "src.main"]
