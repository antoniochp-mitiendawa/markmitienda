#!/data/data/com.termux/files/usr/bin/bash
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${YELLOW}   INSTALADOR MARKMITIENDA V9           ${NC}"
echo -e "${BLUE}=========================================${NC}"

echo -e "${BLUE}[ 1/5 ]${NC} Actualizando sistema..."
pkg update -y && pkg upgrade -y

echo -e "${BLUE}[ 2/5 ]${NC} Instalando Node.js y herramientas..."
pkg install -y nodejs git python clang make

echo -e "${BLUE}[ 3/5 ]${NC} Creando carpeta del proyecto..."
mkdir -p $HOME/markmitienda
cd $HOME/markmitienda

echo -e "${BLUE}[ 4/5 ]${NC} Instalando dependencias npm..."
npm init -y
npm install @whiskeysockets/baileys@6.7.0 pino sql.js axios

echo -e "${BLUE}[ 5/5 ]${NC} Descargando archivos del bot..."
curl -o bot.js https://raw.githubusercontent.com/antoniochp-mitiendawa/markmitienda/main/bot.js
curl -o emojis.js https://raw.githubusercontent.com/antoniochp-mitiendawa/markmitienda/main/emojis.js
curl -o sinonimos.js https://raw.githubusercontent.com/antoniochp-mitiendawa/markmitienda/main/sinonimos.js

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}INSTALACION COMPLETADA${NC}"
echo -e "${GREEN}Ejecuta: cd ~/markmitienda && node bot.js${NC}"
echo -e "${GREEN}=========================================${NC}"
