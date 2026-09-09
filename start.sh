#!/bin/bash

# Change to script directory regardless of where it's run from
cd "$(dirname "$0")"

# Raise file descriptor limit on macOS to prevent Errno 24 (Too many open files)
ulimit -n 4096 2>/dev/null || true

# Auto-restore .env from private GitHub Gist if missing (for seamless fresh clones)
if [ ! -f ".env" ]; then
    GIST_ID="81b78f3b76d8ad1d597f88eb208a7bde"
    if command -v gh &>/dev/null && gh auth status &>/dev/null; then
        echo "  🔑 Restoring .env from private GitHub Gist..."
        gh gist view "$GIST_ID" -f .env -r > .env 2>/dev/null || true
    fi
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        cp .env.example .env
    fi
fi

# Clean shutdown handler
cleanup() {
    echo ""
    echo "🛑 Shutting down QuickLook servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    lsof -ti:5001,5173 | xargs kill -9 2>/dev/null || true
    echo "✅ Both servers stopped cleanly."
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "🚀 Starting QuickLook Finance Dashboard..."

# 0. Ensure old instances are stopped so ports 5001 & 5173 are free
lsof -ti:5001,5173 | xargs kill -9 2>/dev/null || true
sleep 1

# Check for virtualenv if present
if [ -d ".venv" ] && [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Check Python command
PYTHON_CMD="python3"
if ! command -v python3 &>/dev/null; then
    if command -v python &>/dev/null; then
        PYTHON_CMD="python"
    else
        echo "❌ Error: Python 3 is not installed or not in PATH."
        exit 1
    fi
fi

# Check Python backend dependencies
if ! $PYTHON_CMD -c "import flask, flask_cors, requests, yfinance, pandas, numpy" &>/dev/null; then
    echo "  📦 Installing missing Python dependencies..."
    $PYTHON_CMD -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ Error installing Python dependencies. Please run: pip install -r requirements.txt"
        exit 1
    fi
fi

# Check Node.js / NPM and Frontend dependencies
if ! command -v npm &>/dev/null; then
    echo "❌ Error: npm is not installed or not in PATH."
    exit 1
fi

if [ ! -d "web/node_modules" ] || [ ! -f "web/node_modules/.bin/vite" ]; then
    echo "  📦 Installing frontend dependencies (npm install in web/)..."
    (cd web && npm install)
    if [ $? -ne 0 ]; then
        echo "❌ Error installing npm dependencies. Please run 'cd web && npm install'."
        exit 1
    fi
fi

# 1. Start Python Flask API backend on port 5001
echo "  🐍 Launching Backend API (Python/Flask)..."
export PYTHONUNBUFFERED=1
$PYTHON_CMD -u api.py &
BACKEND_PID=$!

sleep 1.2

# Check if Backend is still alive
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend API failed to start. Check api.py errors above."
    cleanup
    exit 1
fi

# 2. Start Vite React frontend on port 5173
echo "  ⚡ Launching Frontend App (Vite/React)..."
(cd web && npm run dev) &
FRONTEND_PID=$!

sleep 1.2

# Check if Frontend is still alive
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend App failed to start."
    cleanup
    exit 1
fi

echo ""
echo "=================================================="
echo "  📊 Dashboard:  http://localhost:5173"
echo "  🔌 API Server: http://127.0.0.1:5001"
echo "=================================================="
echo "Press Ctrl+C at any time to stop both servers."
echo ""

# Open dashboard in user's default browser
if command -v open &>/dev/null; then
    open "http://localhost:5173" 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:5173" 2>/dev/null || true
elif command -v sensible-browser &>/dev/null; then
    sensible-browser "http://localhost:5173" 2>/dev/null || true
elif command -v cmd.exe &>/dev/null; then
    cmd.exe /c start "http://localhost:5173" 2>/dev/null || true
fi

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID


