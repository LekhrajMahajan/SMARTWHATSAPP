# --- Stage 1: Build Frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# --- Stage 2: Final Backend Image ---
FROM python:3.11-slim

# Install Chromium and Chromium-driver
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    unzip \
    curl \
    libglib2.0-0 \
    libnss3 \
    libfontconfig1 \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for Hugging Face
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy backend requirements and install
COPY --chown=user backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy backend code
COPY --chown=user backend/ .

# Copy built frontend from Stage 1
COPY --chown=user --from=frontend-build /frontend/dist ./frontend_dist

# Override the static files path in main.py logic (handled via env or relative path)
# In your main.py, ensure it looks for 'frontend_dist' 

# Create uploads and profile directory (ensuring they are directories)
RUN rm -rf uploads chrome_profile && mkdir -p uploads chrome_profile

EXPOSE 7860

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
