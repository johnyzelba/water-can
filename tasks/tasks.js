const { getPlants, getPlant } = require('../utils/plants');
const { sendMsgToUser } = require('../utils/telegramBot');
const Gpio = require('onoff').Gpio;

const waterSelanoid = new Gpio(44, 'out');
const nitrogenPump = new Gpio(26, 'out');
const phosphorusPump = new Gpio(46, 'out');
const potassiumPump = new Gpio(65, 'out');
const stirrer = new Gpio(45, 'out');

const ultraSonic1Trig = new Gpio(47, 'out');
const ultraSonic1Echo = new Gpio(27, 'in');
const ultraSonic2Trig = new Gpio(62, 'out');
const ultraSonic2Echo = new Gpio(36, 'in');
const waterFlow = new Gpio(32, 'out');

waterSelanoid.writeSync(1);
nitrogenPump.writeSync(1);
phosphorusPump.writeSync(1);
potassiumPump.writeSync(1);
stirrer.writeSync(1);

const SOIL_MOISTURE_WATERING_THRESHOLD = 15;
const EMPTY_WATER_CAN_SENSOR_VALUE = 5;

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



const getLatestPlantsReports = async (db, plants) => {
    console.log(`GETTING LATEST PLANTS REPORTS FROM DB`);
    const plantReportRows = (await Promise.all(
        plants.map(async plant =>
            new Promise(function (resolve, reject) {
                db.all(
                    `SELECT * FROM plant_reports 
                    WHERE plant_id = ${plant.id}
                    ORDER BY timestamp
                    DESC LIMIT 1`,
                    (err, rows) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(rows);
                    }
                )
            })
        )
    )).flat(1);
    console.log(`FOUND ${plantReportRows.length} REPORTS`);
    return plantReportRows.map(row => ({
        plantId: row.plant_id,
        soilMoisture: row.soil_moisture,
        timestamp: row.timestamp
    }));
}

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
            const tasks = await getPendingTasks(db);
            if (!tasks || !tasks.length) {
                return;
            }

            const validateTaskskPromises = tasks.map(runningTask => new Promise(async (res, rej) => {
                (async () => {
                    try {
                        const latestPlantReport = (await getLatestPlantsReports(db, [{ id: runningTask.plantId }]))[0];
                        if (!latestPlantReport) {
                            return rej("NOT_VALID");
                        }
                        const plant = (await getPlant(db, runningTask.plantId))[0];
                        if (!plant) {
                            return rej("NOT_VALID");
                        }
                        const isWaterCanInPlace = await checkWaterCanPosition();
                        if (!isWaterCanInPlace) {
                            return rej("NOT_VALID");
                        }
                        const isWaterCanEnmpty = (await amountOfLiquidInWaterCan()) < EMPTY_WATER_CAN_SENSOR_VALUE;
                        if (!isWaterCanEnmpty) {
                            return rej("NOT_VALID");
                        }

                        if (latestPlantReport.soilMoisture < SOIL_MOISTURE_WATERING_THRESHOLD) {
                            console.log(`VALIDATION_FINNISHED_SUCCSESSFULY`);
                            return res({
                                task: runningTask,
                                plant
                            });
                        } else {
                            console.log(`PLANT DON'T NEED WATERING`);
                            // TODO: remove task
                            return rej("NOT_VALID");
                        }
                    } catch (e) {
                        return rej(e);
                        // TODO handle
                    }
                })
            }));


            let res;
            try {
                res = await promise.all(validateTaskskPromises);
            } catch (e) {
                if (e === "NOT-VALID") {
                    // do nothing?
                } else {
                    console.log(e);
                }
            }
            console.log("---------------res:  ", res);
            // try {
            //     const runningTaskRes = await new Promise(async (res, rej) => {
            //         try {
            //             console.log(`RUNNING TASK ID: ${validatedTasksIdsPlants[0].task.id}`);
            //             sendMsgToUser(`Filling water can for plant: ${validatedTasksIdsPlants[0].plant.name}(${validatedTasksIdsPlants[0].plant.id})`);
            //             // await updateTaskStatus(db, runningTask.id, "IN_PROGRESS");

            //             await fillWaterCan(validatedTasksIdsPlants[0].potSize);
            //             await addNutritions(validatedTasksIdsPlants[0].plant.potSize, validatedTasksIdsPlants[0].plant.n, validatedTasksIdsPlants[0].plant.p, validatedTasksIdsPlants[0].plant.k);

            //             // await updateTaskStatus(db, runningTask.id, "DONE");
            //             sendMsgToUser(`Finnished filling water can for plant: ${validatedTasksIdsPlants[0].plant.name}(${validatedTasksIdsPlants[0].plant.id})`);

            //             return res("RUN_FINNISHED_SUCCSESSFULY");
            //         } catch (e) {
            //             return rej(e);
            //             // TODO handle
            //         }
            //     });
            // } catch (e) {
            //     console.log(e);
            // }
            // console.log(runningTaskRes);
        });
    }
    catch (e) {
        console.log(e);
        return false;
    }

    return true;
};

const checkWaterCanPosition = async () => {
    console.log(`CHECKING IF WATER CAN IS IN PLACE`);
    // TODO: implement
    await new Promise((res, rej) => setTimeout(() => res(true), 2000));
};

const amountOfLiquidInWaterCan = async () => {
    console.log(`CHECKING THE AMOUNT OF LIQUID IN THE WATER CAN`);
    // TODO: implement
    await new Promise((res, rej) => setTimeout(() => res(2), 2000));
};

const fillWaterCan = async (potSize) => {
    console.log(`FILLING WATER CAN WITH WATER`);
    // TODO: implement
    waterSelanoid.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(waterSelanoid.writeSync(1)), 2000));
};

const addNutritions = async (potSize, nitrogen, phosphorus, potassium) => {
    console.log(`ADDING NUTRIENTS TO WATER CAN`);
    // TODO: implement
    nitrogenPump.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(nitrogenPump.writeSync(1)), 2000));

    phosphorusPump.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(phosphorusPump.writeSync(1)), 2000));

    potassiumPump.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(potassiumPump.writeSync(1)), 2000));

    console.log(`STIRRING WATER CAN`);
    stirrer.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(stirrer.writeSync(1)), 2000));
};

module.exports = { generateTasksIfNeeded, runTaskIfNeeded };