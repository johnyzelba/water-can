const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios/dist/node/axios.cjs');
const axiosRetry = require('axios-retry');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config()

const { getDataFromRouterAndSave, getRouterIps } = require("./router/router");
const { generateTasksIfNeeded, runTaskIfNeeded } = require("./tasks/tasks");
const { startTransaction, endTransaction } = require('./utils/transactions');

const token = process.env.TELEGRAM_TOKEN;
console.log("----------------", process.env.TELEGRAM_TOKEN);
const bot = new TelegramBot(token, { polling: true });

path.resolve(__dirname, '../../../dev.sqlite3');

axiosRetry(axios, {
    retries: 5,
    retryDelay: (retryCount) => {
        console.log(`retry attempt: ${retryCount}`);
        return retryCount * 3000;
    },
    retryCondition: (error) => {
        return true;
    },
});

Object.defineProperty(Array.prototype, 'flat', {
    value: function (depth = 1) {
        return this.reduce(function (flat, toFlatten) {
            return flat.concat((Array.isArray(toFlatten) && (depth > 1)) ? toFlatten.flat(depth - 1) : toFlatten);
        }, []);
    }
});

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
    // 'msg' is the received Message from Telegram
    // 'match' is the result of executing the regexp above on the text content
    // of the message

    const chatId = msg.chat.id;
    const resp = match[1]; // the captured "whatever"

    // send back the matched "whatever" to the chat
    bot.sendMessage(chatId, resp);
});

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // send a message to the chat acknowledging receipt of their message
    bot.sendMessage(chatId, 'Received your message');
});

app.all('/*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET");
    next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// cron.schedule("* * * * *", async () => {
// try {
//     await startTransaction(db);
//     const routersWithIp = await getRouterIps(db);
//     if (!routersWithIp) {
//         throw "No ips or routers";
//     }
//     const newPlantReports = await getDataFromRouterAndSave(db, routersWithIp);
//     if (newPlantReports && newPlantReports.length) {
//         await generateTasksIfNeeded(db);
//     }
//     await endTransaction(db);
// } catch (error) {
//     await endTransaction(db);
// }
// });

app.get('/runtask', async function (req, res) {
    try {
        await startTransaction(db);
        await runTaskIfNeeded(db);
        await endTransaction(db);
        res.send({ })
    } catch (error) {
        await endTransaction(db);
        res.send({ 'ok': false, 'msg': error });
    }
});

app.get('/plants', async function (req, res) {
    try {
        await startTransaction(db);
        const routersWithIp = await getRouterIps(db);
        if (!routersWithIp) {
            throw "No ips or routers";
        }
        const newPlantReports = await getDataFromRouterAndSave(db, routersWithIp);
        if (newPlantReports && newPlantReports.length) {
            await generateTasksIfNeeded(db);
        }
        await endTransaction(db);
        res.send({ newPlantReports })
    } catch (error) {
        await endTransaction(db);
        res.send({ 'ok': false, 'msg': error });
    }
});


const db = new sqlite3.Database('/home/debian/water-can/WaterCan.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('CONNECTED TO DB');

    app.listen(6069, (error) => {
        if (error) {
            db.close((err) => {
                if (err) {
                    return console.error(err.message, db);
                }
                console.log('DB CONNECTION CLOSED');
            });
            return error;
        }
        console.log("SERVER IS RUNNING");
    });
});
