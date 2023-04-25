const getPlants = async (db) => {
    console.log(`GETTING PLANTS FROM DB`);
    const plantRows = await new Promise(function (resolve, reject) {
        return db.all(
            `SELECT * FROM plants`,
            (err, rows) => {
                if (err) {
                    reject(err);
                }
                resolve(rows);
            }
        );
    });
    console.log(`FOUND ${plantRows.length} PLANTS`);
    return plantRows.map(row => ({
        id: row.id,
        name: row.name,
        sensorMac: row.sensor_mac,
        potSize: row.pot_size,
        n: row.n,
        p: row.p,
        k: row.k
    }));
};

module.exports = { getPlants };