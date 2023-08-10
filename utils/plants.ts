type PlantRow = {
    id: string,
    name: string,
    mac: string,
    router_mac: string,
    pot_size: number,
    n: number,
    p: number,
    k: number
}

export type Plant = {
    id: string,
    name: string,
    mac: string,
    routerMac: string,
    potSize: number,
    n: number,
    p: number,
    k: number
}

export const getPlants = async (db): Promise<Plant[]> => {
    console.log(`GETTING PLANTS FROM DB`);
    const plantRows: PlantRow[] = await new Promise(function (resolve, reject) {
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
        mac: row.mac,
        routerMac: row.router_mac,
        potSize: row.pot_size,
        n: row.n,
        p: row.p,
        k: row.k
    }));
};

export const getPlant = async (db, plantId): Promise<Plant[]> => {
    console.log(`GETTING PLANTS FROM DB`);
    const plantRows: PlantRow[] = await new Promise(function (resolve, reject) {
        return db.all(
            `SELECT * FROM plants WHERE id = ${plantId}`,
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
        mac: row.mac,
        routerMac: row.router_mac,
        potSize: row.pot_size,
        n: row.n,
        p: row.p,
        k: row.k
    }));
};