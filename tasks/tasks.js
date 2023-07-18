const { getPlants, getPlant } = require('../utils/plants');
const { getLatestPlantsReports } = require('../utils/plantReports');
const { sendMsgToUser } = require('../utils/telegramBot');

const Gpio = require('onoff').Gpio;
const { HCSR04 } = require('HCSR04');

// The number of microseconds it takes sound to travel 1cm at 20 degrees celcius
const MICROSECDONDS_PER_CM = 1e6 / 34321;

const waterSelanoid = new Gpio(44, 'out');
const nitrogenPump = new Gpio(26, 'out');
const phosphorusPump = new Gpio(46, 'out');
const potassiumPump = new Gpio(65, 'out');
const stirrer = new Gpio(45, 'out');

const ultrasonic = new HCSR04(60, 61);


// const ultraSonic1Trig = new Gpio(60, 'out');
// const ultraSonic1Echo = new Gpio(61, 'in', 'falling');
const ultraSonic2Trig = new Gpio(62, 'out');
const ultraSonic2Echo = new Gpio(36, 'in', 'falling');

const waterFlow = new Gpio(32, 'in');

waterSelanoid.writeSync(1);
nitrogenPump.writeSync(1);
phosphorusPump.writeSync(1);
potassiumPump.writeSync(1);
stirrer.writeSync(1);

const SOIL_MOISTURE_WATERING_THRESHOLD = 15;
const EMPTY_WATER_CAN_SENSOR_VALUE = 1000;
const MS_TO_DOSE_ONE_ML = 300;

let waterLevel = 0;

const getPlantsPendingAndInProgressTasks = async (db, plantReports) => {
    console.log(`GETTING PENDING AND IN_PROGRESS TASKS FROM DB`);
    const tasksInProgressRows = (await Promise.all(
        plantReports.map(async plantReport => {
            return new Promise(function (resolve, reject) {
                db.all(
                    `SELECT * FROM tasks 
                    WHERE plant_id = ${plantReport.plantId} AND (status = 'IN_PROGRESS' OR status = 'PENDING')
                    ORDER BY timestamp
                    DESC LIMIT 1`,
                    (err, rows) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(rows);
                    }
                )
            });
        }
        )
    )).flat(1);


    console.log(`FOUND ${tasksInProgressRows.length} PENDING AND IN_PROGRESS TASKS`);
    return tasksInProgressRows.map(row => ({
        id: row.id,
        plantId: row.plant_id,
        status: row.status,
        timestamp: row.timestamp
    }));
};

const getPendingTasks = async (db) => {
    console.log(`GETTING PENDING TASKS FROM DB`);
    const tasksInProgressRows = await new Promise(function (resolve, reject) {
        db.all(
            `SELECT * FROM tasks 
                WHERE  status = 'PENDING'
                ORDER BY timestamp
                DESC`,
            (err, rows) => {
                if (err) {
                    reject(err);
                }
                resolve(rows);
            }
        )
    });
    console.log(tasksInProgressRows);

    console.log(`FOUND ${tasksInProgressRows.length} PENDING TASKS`);
    return tasksInProgressRows.map(row => ({
        id: row.id,
        plantId: row.plant_id,
        status: row.status,
        timestamp: row.timestamp
    }));
};

const generateTasks = async (db, plantReports) => {
    console.log(`SAVING NEW TASKS TO DB`);
    const res = await Promise.all(
        plantReports.map(async plantReport =>
            new Promise(function (resolve, reject) {
                db.all(
                    `INSERT INTO tasks 
                    (plant_id, status, timestamp)
                    VALUES (${plantReport.plantId}, "PENDING", CURRENT_TIMESTAMP)`,
                    (err, rows) => {
                        if (err) {
                            db.rollback();
                            sendMsgToUser(`Generated a new watering task for plant id: ${plantReport.plantId}`);
                            reject(err);
                        }
                        resolve("SUCCESS");
                    }
                )
            })
        )
    );
    console.log(`${res.length || "NO"} NEW TASKS CREATED`);
};

const updateTaskStatus = async (db, taskId, status) => {
    console.log(`UPDATING TASK STATUS IN DB`);
    const tasksInProgressRows = await new Promise(function (resolve, reject) {
        db.all(
            `UPDATE tasks SET status = ${status}
            WHERE id = ${taskId}`,
            (err, rows) => {
                if (err) {
                    db.rollback();
                    reject(err);
                }
                resolve(rows);
            }
        )
    });
    console.log(tasksInProgressRows);

    console.log(`TASK STATUS UPDATED SUCCESSFULLY`);
    return;
};


const generateTasksIfNeeded = async (db,) => {
    try {
        await db.serialize(async () => {
            const plants = await getPlants(db);
            const plantsNeedingWater = (await getLatestPlantsReports(db, plants))
            if (plantsNeedingWater.length > 0) {
                const tasksInProgress = await getPlantsPendingAndInProgressTasks(db, plantsNeedingWater);
                const plantsNeedingWaterWithoutTask = plantsNeedingWater
                    .filter(plantReport => !tasksInProgress.find(task => task.plantId === plantReport.plantId))

                if (plantsNeedingWaterWithoutTask && plantsNeedingWaterWithoutTask.length > 0) {
                    await generateTasks(db, plantsNeedingWaterWithoutTask);
                } else {
                    console.log("NO NEED TO GENERATE A NEW TASK");
                }
            } else {
                console.log("NO NEED TO GENERATE A NEW TASK");
            }
        });
    }
    catch (e) {
        console.log(e);
        return false;
    }

    return true;
};

const runTaskIfNeeded = async (db) => {
    try {
        await db.serialize(async () => {
            console.log("VALIDATING TASKS");
            const tasks = await getPendingTasks(db);
            if (!tasks || !tasks.length) {
                "NO PENDING TASKS"
            }
            const validTasks = [];
            for (const runningTask of tasks) {
                    try {
                        const latestPlantReport = (await getLatestPlantsReports(db, [{ id: runningTask.plantId }]))[0];
                        if (!latestPlantReport) {
                            throw "PLANT HAS NO REPORTS";
                        }
                        const plant = (await getPlant(db, runningTask.plantId))[0];
                        if (!plant) {
                            throw "PLANT DON'T EXIST";
                        }
                        if (latestPlantReport.soilMoisture < SOIL_MOISTURE_WATERING_THRESHOLD) {
                            console.log(`TASK VALIDATION FINNISHED SUCCSESSFULY`);
                            validTasks.push({
                                task: runningTask,
                                plant,
                                test: "test"
                            });
                        } else {
                            // TODO: remove task
                            throw "SOIL NOT DRY";
                        }
                    } catch (e) {
                        console.log("VALIDATION FAILED:  ", e);
                        // TODO handle
                    }
            };

            console.log(`THERE ARE ${validTasks.length} VALIDPENDING TASKS`);
            if (!validTasks || !validTasks.length) {
                throw "NO VALID PENDING TASKS";
            }

            console.log("VALIDATING WATER CAN");
            if (!(await isWaterCanInPlace())) {
                throw "WATER CAN NOT IN PLACE";
            }
            const isWaterCanEnmpty = (await amountOfLiquidInWaterCan()) < EMPTY_WATER_CAN_SENSOR_VALUE;
            if (!isWaterCanEnmpty) {
                throw "WATER CAN NOT EMPTY";
            }
            const isWaterFlowing = (await (flowAmount())) > 0 ;
            if (isWaterFlowing) {
                throw "WATER IS FLOWING BEFORE TASK STARTED";
            }
            console.log("WATER CAN IS VALID");

            try {
                console.log(`RUNNING TASK ID: ${validTasks[0].plant.name}(${validTasks[0].task.id})`);
                    sendMsgToUser(`Filling water can for plant: ${validTasks[0].plant.name}(${validTasks[0].plant.id})`);
                    // await updateTaskStatus(db, runningTask.id, "IN_PROGRESS");

                    await fillWaterCan(validTasks[0].plant.potSize);
                    await addNutritions(validTasks[0].plant.potSize, validTasks[0].plant.n, validTasks[0].plant.p, validTasks[0].plant.k);

                    // await updateTaskStatus(db, runningTask.id, "DONE");
                    sendMsgToUser(`Finnished filling water can for plant: ${validTasks[0].plant.name}(${validTasks[0].plant.id})`);

                console.log("TASK FINNISHED SUCCSESSFULY");

            } catch (e) {
                console.log(e);
            }
        });
    }
    catch (e) {
        if (e === "WATER IS FLOWING BEFORE TASK STARTED") {
            // TODO: Serious error handling
        }
        console.log(e);
        return false;
    }

    return true;
};

const isWaterCanInPlace = async () => {
    console.log(`CHECKING IF WATER CAN IS IN PLACE`);
    const maxWaterLevel = 1;
    const minWaterLevel = -1;
    const mesuredWaterLevel = await amountOfLiquidInWaterCan();
    if (mesuredWaterLevel < maxWaterLevel && mesuredWaterLevel > minWaterLevel) {
        return true;
    }
};

const amountOfLiquidInWaterCan = async () => {
    console.log(`CHECKING THE AMOUNT OF LIQUID IN THE WATER CAN`);
    // TODO: implement

    
    waterLevel = ultrasonic.distance();
    console.log('Distance: ' + waterLevel);
    return waterLevel;
};

const flowAmount = async () => {
    console.log(`CHECKING THE AMOUNT OF FLOWING WATER`);
    return await waterFlow.readSync();
};

const fillWaterCan = async (potSize) => {
    console.log(`FILLING WATER CAN WITH WATER`);
    const neededAmountOfWater = calcNeededAmountOfWater(potSize);
    const startTime = new Date();
    let currentTime = new Date();
    let diffMins = 0;
    let amountOfLiquidInWaterCanArr = [(await amountOfLiquidInWaterCan())];
    let iterations = 0;

    while (amountOfLiquidInWaterCanArr[iterations] < neededAmountOfWater || diffMins < 5) {
        waterSelanoid.writeSync(0);
        await new Promise((res, rej) => setTimeout(() => res(waterSelanoid.writeSync(1)), 5000));
        currentTime= new Date();
        diffMins = Math.round((((currentTime - startTime) % 86400000) % 3600000) / 60000);
        amountOfLiquidInWaterCanArr.push(await amountOfLiquidInWaterCan());
        iterations++;

        if (amountOfLiquidInWaterCanArr[iterations] <= amountOfLiquidInWaterCanArr[iterations-1]) {
            throw "SOMETHING'S WRONG!";
        }
    }
    console.log(`FILLED WATER CAN WITH WATER SUCCESSFULLY`);

    return;
};

const addNutritions = async (potSize, nitrogen, phosphorus, potassium) => {
    console.log(`ADDING NUTRIENTS TO WATER CAN`);
    const neededAmountOfWater = calcNeededAmountOfWater(potSize);
    const neededNitrogen = nitrogen * neededAmountOfWater;
    const neededPhosphorus = phosphorus * neededAmountOfWater;
    const neededPotassium = potassium * neededAmountOfWater;

    nitrogenPump.writeSync(0); waterFlow
    await new Promise((res, rej) => setTimeout(() => res(nitrogenPump.writeSync(1)), neededNitrogen * MS_TO_DOSE_ONE_ML));

    phosphorusPump.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(phosphorusPump.writeSync(1)), neededPhosphorus * MS_TO_DOSE_ONE_ML));

    potassiumPump.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(potassiumPump.writeSync(1)), neededPotassium * MS_TO_DOSE_ONE_ML));

    console.log(`STIRRING WATER CAN`);
    stirrer.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(stirrer.writeSync(1)), 15000));
    return;
};

const calcNeededAmountOfWater = (potSize) => {
    return potSize / 0.8; // TODO: real calculation
}

module.exports = { generateTasksIfNeeded, runTaskIfNeeded };