const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

const sendMsgToUser = async (msg) => {
    const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    await bot.sendMessage(chatId, `<b>${now}</b><br/>${msg}<br/>`, { parse_mode: "HTML" });
}

module.exports = { sendMsgToUser };