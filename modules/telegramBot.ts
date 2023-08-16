import TelegramBot from 'node-telegram-bot-api';
import { TBTOKEN, TBCHATID } from '../utils/consts';


const bot = new TelegramBot(TBTOKEN, { polling: true });

export const sendMsgToUser = async (msg) => {
    const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    // await bot.sendMessage(TBCHATID, `<b>${now}</b> \n\n${msg} \n\n`, { parse_mode: "HTML" });
};