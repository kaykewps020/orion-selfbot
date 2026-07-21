#!/data/data/com.termux/files/usr/bin/bash
#
# ORION SELFBOT - RUNNER / WATCHDOG
# Uso: bash run.sh
# Mantem o bot rodando 24/7 com restart a cada 5.5h
#

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

BANNER="${RED}
██████  ██████  ██ ██████  ██    ██
██   ██ ██   ██ ██ ██   ██ ██    ██
██████  ██████  ██ ██████  ██    ██
██   ██ ██   ██ ██ ██   ██ ██    ██
██   ██ ██   ██ ██ ██   ██  ██████
${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ─── CONFIG ───────────────────────────────────────────────────────────────────
RESTART_INTERVAL=$((5 * 3600 + 30 * 60))  # 5.5 hours in seconds
HEARTBEAT_INTERVAL=300  # 5 minutes
LOG_FILE="orion_watchdog.log"

# ─── FUNCTIONS ────────────────────────────────────────────────────────────────
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$LOG_FILE"
}

check_deps() {
    if ! command -v node &>/dev/null; then
        log "${RED}❌ Node.js nao encontrado!${NC}"
        exit 1
    fi
    
    if [ ! -f "node_modules/.package-lock.json" ] && [ ! -d "node_modules/discord.js-selfbot-v13" ]; then
        log "${YELLOW}📦 Instalando dependencias...${NC}"
        npm install --no-optional 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Check config
    if [ ! -f "config.json" ]; then
        log "${RED}❌ config.json nao encontrado!${NC}"
        exit 1
    fi
    
    # Check if token is set
    local token=$(node -e "console.log(JSON.parse(require('fs').readFileSync('config.json','utf8')).token)" 2>/dev/null)
    if [ -z "$token" ] || [ "$token" = "SEU_TOKEN_AQUI" ]; then
        log "${RED}❌ Token nao configurado! Edite config.json${NC}"
        log "${YELLOW}⚠️  Ou use: export DISCORD_TOKEN=seu_token && node -e \"const fs=require('fs');const c=JSON.parse(fs.readFileSync('config.json','utf8'));c.token=process.env.DISCORD_TOKEN;fs.writeFileSync('config.json',JSON.stringify(c,null,2))\"${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ Dependencias OK${NC}"
}

start_bot() {
    log "${CYAN}🚀 Iniciando Orion Selfbot...${NC}"
    node orion.js >> "$LOG_FILE" 2>&1 &
    BOT_PID=$!
    log "${GREEN}✅ Orion rodando (PID: $BOT_PID)${NC}"
    echo $BOT_PID > orion.pid
    
    # Wait briefly to check if it crashed immediately
    sleep 5
    if ! kill -0 $BOT_PID 2>/dev/null; then
        log "${RED}❌ Bot morreu logo ao iniciar!${NC}"
        wait $BOT_PID
        return 1
    fi
    
    return 0
}

stop_bot() {
    if [ -f orion.pid ]; then
        local pid=$(cat orion.pid)
        log "${YELLOW}⏹ Parando Orion (PID: $pid)...${NC}"
        kill $pid 2>/dev/null
        sleep 2
        kill -9 $pid 2>/dev/null
        rm -f orion.pid
    fi
    
    # Kill any python DDoS processes too
    pkill -f ddos_engine.py 2>/dev/null || true
    
    log "${GREEN}✅ Orion parado${NC}"
}

print_status() {
    local uptime_seconds=$1
    local hours=$((uptime_seconds / 3600))
    local mins=$(( (uptime_seconds % 3600) / 60 ))
    local secs=$((uptime_seconds % 60))
    
    echo -e "${PURPLE}[❤️ HEARTBEAT]${NC} $(date '+%H:%M:%S') - Orion ativo | PID: $BOT_PID | Uptime: ${hours}h ${mins}m ${secs}s"
}

# ─── MAIN ─────────────────────────────────────────────────────────────────────
echo -e "$BANNER"
echo -e "${CYAN}✦═══════════════════════════════════════✧${NC}"
echo -e "${WHITE}  ORION SELFBOT v2 - WATCHDOG${NC}"
echo -e "${WHITE}  Restart a cada: ${YELLOW}5.5 horas${NC}"
echo -e "${WHITE}  Heartbeat: ${YELLOW}a cada 5 min${NC}"
echo -e "${CYAN}✦═══════════════════════════════════════✧${NC}"
echo ""

# Check dependencies
check_deps

# Trap for cleanup
trap 'log "${YELLOW}⚠️ Recebido sinal de parada. Limpando...${NC}"; stop_bot; exit 0' SIGINT SIGTERM

# Main loop - restart every 5.5 hours
RESTART_COUNT=0
START_TIME=$(date +%s)

while true; do
    RESTART_COUNT=$((RESTART_COUNT + 1))
    log "${CYAN}═══════ Inicio #$RESTART_COUNT ═══════${NC}"
    
    start_bot
    if [ $? -ne 0 ]; then
        log "${RED}❌ Falha ao iniciar bot. Tentando novamente em 30s...${NC}"
        sleep 30
        continue
    fi
    
    # Heartbeat loop
    ITERATION_START=$(date +%s)
    while true; do
        sleep 10
        
        # Check if bot is alive
        if ! kill -0 $BOT_PID 2>/dev/null; then
            log "${RED}❌ Bot morreu! Reiniciando...${NC}"
            break
        fi
        
        # Check if it's time to restart
        NOW=$(date +%s)
        ELAPSED=$((NOW - ITERATION_START))
        TOTAL_ELAPSED=$((NOW - START_TIME))
        
        if [ $ELAPSED -ge $RESTART_INTERVAL ]; then
            log "${YELLOW}⏱ ${RESTART_INTERVAL}s atingido! Reiniciando bot...${NC}"
            stop_bot
            break
        fi
        
        # Heartbeat log
        if [ $((ELAPSED % HEARTBEAT_INTERVAL)) -lt 15 ]; then
            print_status $TOTAL_ELAPSED
        fi
    done
    
    # Small delay before restart
    sleep 5
done
