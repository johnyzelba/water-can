const { getPlants, getPlant } = require('../utils/plants');
const { getLatestPlantsReports } = require('../utils/plantReports');
const { sendMsgToUser } = require('../utils/telegramBot');
const { validateWaterCan, fillWaterCan, addNutritions, resetWaterValve, getFlowAmount } = require('../utils/waterCan');
const { SOIL_MOISTURE_WATERING_THRESHOLD } = require('../utils/consts');


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
                    (err) => {
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
            const validTasks = await validateTasks(db, tasks);

            if (!tasks || !tasks.length) {
                "NO PENDING TASKS"
            }
            console.log(`THERE ARE ${tasks.length} PENDING TASKS`);
            if (!validTasks || !validTasks.length) {
                throw "NO VALID PENDING TASKS";
            }
            // await validateWaterCan();
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
            for (const _ of new Array(50).fill(true)) {
                await resetWaterValve();
                const isWaterFlowing = (await (getFlowAmount())) > 0;
                if (isWaterFlowing) {
                    await new Promise((res) => setTimeout(() => res(sendMsgToUser("Water is flowing before task started!!!"), 10000)));
                }
            }
        }
        console.log(e);
        return false;
    }

    return true;
};

const validateTasks = async (db, tasks) => {
    console.log("VALIDATING TASKS");
    const validTasks = [];
    for (const runningTask of tasks) {
        const latestPlantReport = (await getLatestPlantsReports(db, [{ id: runningTask.plantId }]))[0];
        const plant = (await getPlant(db, runningTask.plantId))[0];

        if (!latestPlantReport) {
            console.log("VALIDATION FAILED: PLANT HAS NO REPORTS");
        } else if (latestPlantReport.timestamp < new Date().getTime() - (7 * 24 * 60 * 60 * 1000)) {
            console.log("VALIDATION FAILED: PLANT REPORT IS TO OLD");
            sendMsgToUser(`A plant had no reports in the past week (plant id: ${runningTask.plantId})`);
        } else if (!plant) {
            console.log("VALIDATION FAILED: PLANT DON'T EXIST");
        } else if (latestPlantReport.soilMoisture < SOIL_MOISTURE_WATERING_THRESHOLD) {
            console.log(`TASK VALIDATION FINNISHED SUCCSESSFULY`);
            validTasks.push({
                task: runningTask,
                plant,
                test: "test"
            });
            break;
        } else {
            console.log("VALIDATION FAILED: PLANT SOIL IS MOIST");
        }
        await updateTaskStatus(db, runningTask.id, "ABORTED");
    }
    console.log(`THERE ARE ${validTasks.length} VALID TASKS`);
    return validTasks;
};


module.exports = { generateTasksIfNeeded, runTaskIfNeeded };