const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios/dist/node/axios.cjs');
const axiosRetry = require('axios-retry');
// const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const path = require('path');
const { sendMsgToUser } = require('./utils/telegramBot');
const { getDataFromRouterAndSave, getRouterIps } = require("./router/router");
const { generateTasksIfNeeded, runTaskIfNeeded } = require("./tasks/tasks");
const { startTransaction, endTransaction } = require('./utils/transactions');
const process = require('node:process');


// This is an example of reading HC-SR04 Ultrasonic Range Finder
// This version measures from the fall of the Trigger pulse 
//   to the end of the Echo pulse

var b = require('bonescript');

var trigger = 'P9_16',  // Pin to trigger the ultrasonic pulse
    echo = 'P9_41',  // Pin to measure to pulse width related to the distance
    ms = 1000;           // Trigger period in ms

var startTime, pulseTime;

b.pinMode(echo, b.INPUT, 7, 'pulldown', 'fast', doAttach);
function doAttach(x) {
    if (x.err) {
        console.log('x.err = ' + x.err);
        return;
    }
    // Call pingEnd when the pulse ends
    b.attachInterrupt(echo, true, b.FALLING, pingEnd);
}

b.pinMode(trigger, b.OUTPUT);

b.digitalWrite(trigger, 1);     // Unit triggers on a falling edge.
// Set trigger to high so we call pull it low later


// Pull trigger low and start timing.
function ping() {
    console.log('ping');
    b.digitalWrite(trigger, 0);
    startTime = process.hrtime();
}

// Compute the total time and get ready to trigger again.
function pingEnd(x) {
    if (x.attached) {
        console.log("Interrupt handler attached");
        return;
    }
    if (startTime) {
        pulseTime = process.hrtime(startTime);
        b.digitalWrite(trigger, 1);
        console.log('pulseTime = ' + (pulseTime[1] / 1000000 - 0.8).toFixed(3));
    }
}



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

Object.defineProperty(Array.prototype, 'flat', {
    value: function (depth = 1) {
        return this.reduce(function (flat, toFlatten) {
            return flat.concat((Array.isArray(toFlatten) && (depth > 1)) ? toFlatten.flat(depth - 1) : toFlatten);
        }, []);
    }
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

    app.listen(6069, async(error) => {
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
        sendMsgToUser(`Server started`);
        // Pull the trigger low at a regular interval.
        setInterval(ping, ms);
    });
});
