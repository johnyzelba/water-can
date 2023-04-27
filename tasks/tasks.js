const { getPlants } = require('../utils/plants');

const getPlantsPendingAndInProgressTasks = async (db, plantReports) => {
    console.log(`GETTING PENDING AND IN_PROGRESS TASKS FROM DB`);
    consttasksInProgressRows = (await Promise.all(
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
    console.log(`GETTING PENDING AND IN_PROGRESS TASKS FROM DB`);
    consttasksInProgressRows = [
        await new Promise(function (resolve, reject) {
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
        })
    ];

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


const generateTasksIfNeeded = async (db,) => {
    try {
        await db.serialize(async () => {
            const plants = await getPlants(db);
            const plantsNeedingWater = (await getLatestPlantsReports(db, plants))
                .filter(plantReport => plantReport.soilMoisture <= 100);

            if (plantsNeedingWater.length > 0) {
                const tasksInProgress = await getPlantsPendingAndInProgressTasks(db, plantsNeedingWater);
                const plantsNeedingWaterWithoutTask = plantsNeedingWater
                    .filter(plantReport => !tasksInProgress.find(task => task.plantId === plantReport.plantId))

                if (plantsNeedingWaterWithoutTask && plantsNeedingWaterWithoutTask.length > 0) {
                    await generateTasks(db, plantsNeedingWaterWithoutTask);
                } else {
                    console.log("NO NEED TO GENERATE A NEW TASK");
                }
            }
        });
    }
    catch (e) {
        console.log(e);
        return false;
    }

    return true;
};

const runTaskIfNeeded = async (db,) => {
    try {
        await db.serialize(async () => {
            const tasks = await getPendingTasks(db);
            const runningTask = tasks[0];
            const plantReports = await getLatestPlantsReports(db, [{ id: runningTask.plantIs }]);
            console.log(runningTask);
            console.log(plantReports);
        });
    }
    catch (e) {
        console.log(e);
        return false;
    }

    return true;
};

module.exports = { generateTasksIfNeeded, runTaskIfNeeded };