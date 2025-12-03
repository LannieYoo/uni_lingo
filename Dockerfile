# Multi-stage build for Portal Translator
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Python backend with frontend
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements
COPY scripts/requirements_whisper.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements_whisper.txt

# Copy backend scripts
COPY scripts/ ./scripts/

# Copy built frontend from builder
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Create nginx configuration
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Serve frontend \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Proxy API requests to Flask backend \
    location /api/ { \
        proxy_pass http://127.0.0.1:8001; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/sites-available/default

# Create supervisor configuration
RUN echo '[supervisord] \
nodaemon=true \
\
[program:nginx] \
command=nginx -g "daemon off;" \
autostart=true \
autorestart=true \
\
[program:flask] \
command=python /app/scripts/whisper_server.py --host 0.0.0.0 --port 8001 \
directory=/app \
autostart=true \
autorestart=true \
stdout_logfile=/var/log/flask.log \
stderr_logfile=/var/log/flask_error.log' > /etc/supervisor/conf.d/supervisord.conf

# Expose port
EXPOSE 80

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

