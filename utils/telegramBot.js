const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

const sendMsgToUser = async (msg) => {
    const now = new Date().toLocaleString('he-IL');
    await bot.sendMessage(chatId, `${now}: ${msg}`);
}

module.exports = { sendMsgToUser };