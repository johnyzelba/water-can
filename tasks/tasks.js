const { getPlants, getPlant } = require('../utils/plants');
const Gpio = require('onoff').Gpio;

const waterSelanoid = new Gpio(67, 'out');
const nitrogenPump = new Gpio(68, 'out');
const phosphorusPump = new Gpio(44, 'out');
const potassiumPump = new Gpio(26, 'out');
const stirrer = new Gpio(46, 'out');

const ultraSonic1Trig = new Gpio(66, 'out');
const ultraSonic1Echo = new Gpio(69, 'in');
const ultraSonic2Trig = new Gpio(45, 'out');
const ultraSonic2Echo = new Gpio(47, 'in');
const waterFlow = new Gpio(27, 'out');

const SOIL_MOISTURE_WATERING_THRESHOLD = 15;

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
                            db.all('ROLLBACK');
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
                    db.all('ROLLBACK');
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
                .filter(plantReport => plantReport.soilMoisture < SOIL_MOISTURE_WATERING_THRESHOLD);

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
            const runningTask = tasks[0];
            const latestPlantReport = await getLatestPlantsReports(db, [{ id: runningTask.plantId }])[0];
            if (!latestPlantReport) {
                throw "plant report not found";
            }
            const plant = await getPlant(db, runningTask.plantId)[0];
            if (!plant) {
                throw "plant not found";
            }

            if (latestPlantReport.soilMoisture < SOIL_MOISTURE_WATERING_THRESHOLD) {
                console.log(`RUNNING TASK ID: ${runningTask.id}`);
                // await updateTaskStatus(db, runningTask.id, "IN_PROGRESS");

                // await fillWaterCan(plant.potSize);
                // await addNutritions(plant.potSize, plant.n, plant.p, plant.k);
                // await notify(plant.id, plant.name);

                // await updateTaskStatus(db, runningTask.id, "DONE");
            }
        });
    }
    catch (e) {
        console.log(e);
        return false;
    }

    return true;
};

const fillWaterCan = async (potSize) => {
};

const addNutritions = async (potSize, nitrogen, phosphorus, potassium) => {
};

const notify = async (plnatId, plantName) => {
};

module.exports = { generateTasksIfNeeded, runTaskIfNeeded };