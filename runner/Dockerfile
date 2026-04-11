# Claude Code Runner — isolated story execution container
# Spec ref: AgenticSquad_Functional_Spec v2.8 RC §6.3.5, §9.4
#
# Base: Node.js 20 (required for Claude Code CLI)
# Extras: git, Python 3, Go (for multi-language repo support)
# Security: runs as non-root user, no trading infra credentials

FROM node:20-bookworm-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Go (for order-router service — lightweight install)
ARG GO_VERSION=1.22.5
RUN curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:${PATH}"

# Claude Code CLI (global install)
RUN npm install -g @anthropic-ai/claude-code

# Python linting tools (used by Claude Code for code quality)
RUN pip3 install --break-system-packages ruff black

# Create non-root user for execution
RUN useradd -m -s /bin/bash runner \
    && mkdir -p /workspace \
    && chown runner:runner /workspace

# Copy entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Workspace for repo clone
WORKDIR /workspace

# Run as non-root
USER runner

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
