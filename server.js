const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios/dist/node/axios.cjs');
const axiosRetry = require('axios-retry');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const path = require('path');

const { getDataFromRouterAndSave, getRouterIps } = require("./router/router");
const { generateTasksIfNeeded } = require("./tasks/tasks");

path.resolve(__dirname, '../../../dev.sqlite3')

const db = new sqlite3.Database('/home/debian/water-can/WaterCan.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the in-memory SQlite database.');
});

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

app.all('/*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET");
    next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Read router information
// cron.schedule("* * * * *", async () => {
//     console.log('-----CRON-----');
//     try {
//         await getDataFromRouterAndSave(db);
//     } catch (error) {
//         console.log(error);
//     }
//     console.log("-------------");
// });

app.get('/ingredients', async function (req, res) {
    try {
        const routersWithIp = await getRouterIps(db);
        const newPlantReports = await getDataFromRouterAndSave(db, routersWithIp);
        if (newPlantReports) {
            await generateTasksIfNeeded(db, newPlantReports);
        }
        res.send({})
    } catch (error) {
        res.send({ 'ok': false, 'msg': error });
    }
});

app.listen(6069, (error) => {
    if (error) {
        db.close((err) => {
            if (err) {
                return console.error(err.message, db);
            }
            console.log('Close the database connection.');
        });
        return error;
    }
    console.log("Server is running");
});