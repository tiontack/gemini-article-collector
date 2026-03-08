#!/bin/bash
echo "Starting Gemini Article Collector..."

# Start backend
cd "$(dirname "$0")/backend"
node server.js &
BACKEND_PID=$!

# Start frontend
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ Backend:  http://localhost:3002"
echo "✓ Frontend: http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
