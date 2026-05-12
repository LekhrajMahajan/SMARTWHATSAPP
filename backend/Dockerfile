FROM python:3.11-slim

# Install Chromium and Chromium-driver (Lighter than Google Chrome)
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

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads and profile directory
RUN mkdir -p uploads chrome_profile

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
