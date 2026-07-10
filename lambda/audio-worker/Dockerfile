# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json ./
# Install all deps (including devDeps for tsc)
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
# Use the official AWS Lambda Node.js 20 base image
FROM public.ecr.aws/lambda/nodejs:20

# Install FFmpeg static binary
# Using the johnvansickle static build (no shared lib dependencies)
RUN dnf install -y xz tar && \
    curl -L "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" \
      -o /tmp/ffmpeg.tar.xz && \
    tar -xf /tmp/ffmpeg.tar.xz -C /tmp && \
    mv /tmp/ffmpeg-*/ffmpeg /opt/bin/ffmpeg && \
    chmod +x /opt/bin/ffmpeg && \
    rm -rf /tmp/ffmpeg*

ENV FFMPEG_PATH=/opt/bin/ffmpeg

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy production deps only
COPY --from=builder /app/package.json ./
RUN npm install --omit=dev

# Copy compiled output
COPY --from=builder /app/dist ./dist

CMD ["dist/index.handler"]
