module.exports = {
  apps : [{
    name: "smart-wa",
    script: "venv/Scripts/uvicorn.exe",
    args: "main:app --host 0.0.0.0 --port 8000",
    cwd: "./backend",
    interpreter: "none", 
    env: {
      NODE_ENV: "production",
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "../logs/error.log",
    out_file: "../logs/out.log",
    merge_logs: true
  }]
}
