import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import axiosRetry from 'axios-retry';
const cron = require('node-cron');
import sqlite3 from 'sqlite3';
const app = express();
import path from 'path';
import { sendMsgToUser } from './modules/telegramBot';
import { getDataFromRouterAndSave, getRouterIps } from './modules/router';
import { generateTasksIfNeeded, runTaskIfNeeded } from './modules/tasks';
import { startTransaction, endTransaction, rollbackTransaction } from './utils/transactions';
import { isWaterFlowing } from './modules/waterCan';

path.resolve(__dirname, '../../../dev.sqlite3');

axiosRetry(axios, {
    retries: 5,
    retryDelay: (retryCount) => {
        console.log(`retry attempt: ${retryCount}`);
        return retryCount * 3000;
    },
    retryCondition: () => {
        return true;
    },
});

let isTaskRunning = false;

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
//     await rollbackTransaction(db);
// }
// });

// cron.schedule("* * * * *", async () => {
//     try {
//         isTaskRunning = true;
//         await startTransaction(db);
//         await runTaskIfNeeded(db);
//         await endTransaction(db);
//         isTaskRunning = false;
//     } catch (error) {
//         await rollbackTransaction(db);
//         isTaskRunning = false;
//     }
// });

// cron.schedule("* * * * *", async () => {
//     if (!isTaskRunning && isWaterFlowing()) {
//         const err = `SOMETHING'S WRONG! (water is flowing and should not)`;
//         console.error(err);
//         sendMsgToUser(err);
//     }
// });


app.all('/*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET");
    next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/runtask', async function (req, res) {
    try {
        isTaskRunning = true;
        await startTransaction(db);
        await runTaskIfNeeded(db);
        await endTransaction(db);
        isTaskRunning = false;
        res.send({ })
    } catch (error) {
        await rollbackTransaction(db);
        isTaskRunning = false;
        res.send({ 'ok': false, 'msg': error });
    }
});

app.get('/scanplants', async function (req, res) {
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
        await rollbackTransaction(db);
        res.send({ 'ok': false, 'msg': error });
    }
});

const db = new sqlite3.Database('/home/johny/water-can/WaterCan.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('CONNECTED TO DB');

    app.listen(6069, async(error) => {
        if (error) {
            console.error(error);
            db.close((err) => {
                if (err) {
                    return console.error(err.message, db);
                }
                console.log('DB CONNECTION CLOSED');
            });
            return error;
        }
        console.log("SERVER IS RUNNING");
        // sendMsgToUser(`Server started`);
    });
});
