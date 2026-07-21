#!/bin/bash
#
# ORION SELFBOT - SETUP
# Configura o token e inicia o bot
#

if [ -z "$1" ]; then
    echo "Uso: bash setup.sh <token_do_discord>"
    echo "Ex: bash setup.sh NDExODc3MjU4MDk2NTQ4OTYw.Gb3R4k.xxxxxxxxxx"
    exit 1
fi

TOKEN="$1"

# Write token to config
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
cfg.token = '$TOKEN';
fs.writeFileSync('config.json', JSON.stringify(cfg, null, 2));
console.log('✅ Token configurado com sucesso!');
"

# Install dependencies
echo "📦 Instalando dependencias..."
npm install --no-optional 2>&1 | tail -5

echo ""
echo "🔥 ORION SELFBOT PRONTO!"
echo "Use: npm start     (iniciar bot)"
echo "Use: bash run.sh   (modo watchdog - restart 5.5h)"
