#!/bin/bash

# Clean shutdown handler
cleanup() {
    echo ""
    echo "🛑 Shutting down QuickLook servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null
    fi
    lsof -ti:5001,5173 | xargs kill -9 2>/dev/null || true
    echo "✅ Both servers stopped cleanly."
    exit 0
}

# Register trap for SIGINT (Ctrl+C), SIGTERM, and EXIT
trap cleanup SIGINT SIGTERM EXIT

echo "🚀 Starting QuickLook Finance Dashboard..."

# 0. Ensure old instances are stopped so ports 5001 & 5173 are free
lsof -ti:5001,5173 | xargs kill -9 2>/dev/null || true
sleep 1

# 1. Start Python Flask API backend on port 5001
echo "  🐍 Launching Backend API (Python/Flask)..."
python3 api.py &
BACKEND_PID=$!

sleep 1.2

# 2. Start Vite React frontend on port 5173
echo "  ⚡ Launching Frontend App (Vite/React)..."
(cd web && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "  📊 Dashboard:  http://localhost:5173"
echo "  🔌 API Server: http://127.0.0.1:5001"
echo "=================================================="
echo "Press Ctrl+C at any time to stop both servers."
echo ""

# Keep script active to handle Ctrl+C signal
wait
