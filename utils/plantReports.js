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

const createPlantsReports = async (db, plantReports) => {
    console.log(`SAVING REPORTS TO DB`);
    const res = (await Promise.all(
        plantReports.map(plantReport => {
            new Promise(function (resolve, reject) {
                if (
                    plantReport.plantId === undefined
                    || plantReport.temperture === undefined
                    || plantReport.soilMoisture === undefined
                    || plantReport.light === undefined
                    || plantReport.soilConductivity === undefined
                ) {
                    var error = new Error('Missing information');
                    console.log(error);
                    db.rollback();
                    reject(error);
                }
                db.all(
                    `INSERT INTO plant_reports (plant_id, temperture, soil_moisture, light, conductivity, timestamp)
       
                        VALUES (${plantReport.plantId}, ${plantReport.temperture}, ${plantReport.soilMoisture}, ${plantReport.light}, ${plantReport.soilConductivity}, CURRENT_TIMESTAMP)`,
                    (error, rows) => {
                        if (error) {
                            console.log(error);
                            db.rollback();
                            reject(error);
                        }
                        console.log(`SAVED SUCCESSFULLY`);
                        resolve(rows);
                    }
                );
            })
        })
    ));
    console.log(`${res.length || "NO"} NEW PLANT REPORTS CREATED`);
}

module.exports = { getLatestPlantsReports, createPlantsReports };