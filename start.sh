#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# ── colours ─────────────────────────────────────────────────────────────────
BOLD='\033[1m'; RESET='\033[0m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; CYAN='\033[36m'

echo ""
echo -e "${BOLD}${CYAN}🔧  FixIt AI${RESET} — Shazam for car problems"
echo -e "─────────────────────────────────────────"
echo ""

# ── require node ─────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found.${RESET}  Install from https://nodejs.org (LTS version)"
  exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
echo -e "  ${GREEN}✓${RESET} Node.js $NODE_VER"

# ── .env setup ───────────────────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo -e "  ${YELLOW}!${RESET} Created backend/.env  →  add ANTHROPIC_API_KEY for real AI"
  echo -e "    (running in DEMO MODE with realistic mock data until then)"
else
  if grep -q "^ANTHROPIC_API_KEY=$" backend/.env 2>/dev/null || grep -q "^ANTHROPIC_API_KEY=your_" backend/.env 2>/dev/null; then
    echo -e "  ${YELLOW}!${RESET} No API key set  →  running in DEMO MODE (mock diagnoses)"
  else
    echo -e "  ${GREEN}✓${RESET} Anthropic API key found"
  fi
fi

# ── install deps ─────────────────────────────────────────────────────────────
echo ""
echo -e "  Installing dependencies…"
(cd backend  && npm install --silent 2>&1 | tail -1)
echo -e "  ${GREEN}✓${RESET} Backend packages ready"
(cd frontend && npm install --silent 2>&1 | tail -1)
echo -e "  ${GREEN}✓${RESET} Frontend packages ready"

# ── kill-on-exit trap ─────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  echo -e "  Shutting down servers…"
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── start backend ─────────────────────────────────────────────────────────────
(cd backend && node server.js) &
PIDS+=($!)
sleep 1   # let backend bind its port

# ── start frontend ────────────────────────────────────────────────────────────
(cd frontend && npx vite --host) &
PIDS+=($!)

echo ""
echo -e "  ${GREEN}${BOLD}Servers started!${RESET}"
echo -e "  Backend  →  ${CYAN}http://localhost:3001${RESET}"
echo -e "  Frontend →  ${CYAN}http://localhost:5173${RESET}  ← open this"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop."
echo ""

wait
