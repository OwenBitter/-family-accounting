#!/bin/bash
# Family Accounting - 启动前后端服务
# 用法: ./start.sh
# 前端 → http://localhost:5174
# 后端 → http://localhost:5000

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
    echo ""
    echo "正在停止所有服务..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "服务已停止。"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "========================================"
echo "  Family Accounting - 启动服务"
echo "========================================"
echo ""

echo "[1/2] 启动后端 (Flask API → :5000)..."
cd "$ROOT/backend"
python app.py &
BACKEND_PID=$!

echo "[2/2] 启动前端 (Vite dev → :5174)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 3
echo ""
echo "[✓] 后端服务运行中 → http://localhost:5000 (PID: $BACKEND_PID)"
echo "[✓] 前端服务运行中 → http://localhost:5174 (PID: $FRONTEND_PID)"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待任一进程退出
wait
