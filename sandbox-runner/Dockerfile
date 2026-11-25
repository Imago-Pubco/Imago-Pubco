# Imago Sandbox runner. Debian (not Alpine): the Claude Agent SDK ships a native binary built for glibc.
FROM node:24-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /runner
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY runner.ts scope.ts ./
# Sessions and the repository clone live in a volume.
RUN mkdir -p /data && chown node:node /data
USER node
ENV REPO_DIR=/data/repo WORK_DIR=/data/sessions RUNNER_PORT=8095 HOME=/home/node
EXPOSE 8095
CMD ["node", "runner.ts"]
