import TelegramBot from 'node-telegram-bot-api';

require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

export const sendMsgToUser = async (msg) => {
    const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    // await bot.sendMessage(chatId, `<b>${now}</b> \n\n${msg} \n\n`, { parse_mode: "HTML" });
};