const axios = require('axios/dist/node/axios.cjs');
const Evilscan = require('evilscan');
const { toMAC } = require('@network-utils/arp-lookup');

const { startTransaction, endTransaction } = require('../utils/transactions');
const { getPlants } = require('../utils/plants');

const getRouters = async (db) => {
    console.log(`GETTING ROUTERS FROM DB`);
    const routerRows = await new Promise(function (resolve, reject) {
        return db.all(
            `SELECT * FROM routers`,
            (err, rows) => {
                if (err) {
                    reject(err);
                }
                resolve(rows);
            }
        );
    });
    console.log(`FOUND ${routerRows.length} ROUTERS`);
    return routerRows.map(row => ({
        id: row.id,
        name: row.name,
        mac: row.mac
    }));
};

const scanIps = async () => {
    const list = [];
    const options = {
        target: '192.168.1.1-189.168.255.255',
        port: '6069',
        status: 'O', // Timeout, Refused, Open, Unreachable
        banner: true
    };
    console.log(`SCANNING FOR IP ADDRESSES`);
    try {
        return new Promise(function (resolve, reject) {
            const evilscan = new Evilscan(options);


            evilscan.on('result', data => {
                // fired when item is matching options
                list.push(data);
            });

            evilscan.on('error', err => {
                reject(new Error(data.toString()));
            });

            evilscan.on('done', () => {
                console.log(`FOUND ${list.length}  IP ADDRESSES WITH OPEN PORT`);
                resolve(list);
            });

            evilscan.run();
        });
    } catch (error) {
        console.log(error);
    }
};

const getMacByIps = async (ipList) => {
    console.log("GETTING MAC ADDRESSES OF SCANED IPS");
    try {
        const macAddrsPromises = ipList.map(ipObj => toMAC(ipObj.ip));
        const macAddrs = await Promise.all(macAddrsPromises);
        const filteredMacIpsAddrs = ipList
            .map((ipObj, index) => ({ ip: ipObj.ip, mac: macAddrs[index] }))
            .filter(obj => !!obj.mac);
        console.log(`FOUND ${filteredMacIpsAddrs.length} MAC ADDRESSES`);
        return filteredMacIpsAddrs;
    } catch (error) {
        console.log(error);
    }
};

const getDataFromRouter = async (ip) => {
    try {
        console.log(`GETTING REPORTS FROM ROUTER`);
        const response = await axios.get(`http://${ip}:6069/plants`);
        if (response.data) {
            console.log(`RECIVED ${response.data.length} REPORTS`);
        }
        return response;
    } catch (error) {
        console.log(error);
    }

};

const saveDataFromRouter = async (data, db) => {
    await db.serialize(async () => {
        console.log(`SAVING REPORTS TO DB`);
        await Promise.all(
            data.map(plantReport => {
                new Promise(function (resolve, reject) {
                    if (!plantReport.plantId || !plantReport.temperture || !plantReport.soilMoisture || !plantReport.light || !plantReport.soilConductivity) {
                        var error = new Error('Missing information');
                        db.each('ROLLBACK').then(() => reject(error));
                    }
                    db.each(
                        `INSERT INTO plant_reports (plant_id, temperture, soil_moisture, light, soil_conductivity, timestamp)
       
                        VALUES (${plantReport.plantId}, ${plantReport.temperture}, ${plantReport.soilMoisture}, ${plantReport.light}, ${plantReport.soilConductivity}, CURRENT_TIMESTAMP)`,
                        (error, rows) => {
                            if (error) {
                                console.log(error);
                                db.each('ROLLBACK').then(() => reject(error));
                            }
                            console.log(`SAVED SUCCESSFULLY`);
                            resolve(rows);
                        }
                    );
                })
            })
        )
            .then(function (arrayOfValuesOrErrors) {
                const errorFlag = false;
                arrayOfValuesOrErrors.map(valueOrError => valueOrError.error ? errorFlag = true : {});
                return errorFlag;
            })
            .catch(function (err) {
                return false;
            });
    }).catch(function (err) {
        return false;
    });
};

const getDataFromRouterAndSave = async (db, routersWithIp) => {
    await startTransaction(db);
    const plants = await getPlants(db);
    const promises = routersWithIp.map(routerWithIp => getDataFromRouter(routerWithIp.ip));
    const responses = await Promise.all(promises);
    //TODO: apply for rest of array
    const response = responses[0];
    if (response.error) {
        throw response.error;
    }
    console.log("---------- ", response.data, " ----- ", plants);

    const dataToSave = response.data.map(dataElement => {
        const plantId = plants.filter(plant => plant.mac === dataElement.deviceId)[0].id;
        return ({
            ...dataElement,
            plantId
        })
    })
    const isSaved = await saveDataFromRouter(dataToSave, db);

    await endTransaction(db);

    return isSaved ? response.data : false;
};

const getRouterIps = async (db) => {
    const ipScanRes = await scanIps();
    const macIpsList = await getMacByIps(ipScanRes);
    const routers = await getRouters(db);
    const routersIps = []

    macIpsList.map(macIp => {
        routers.map(router => {
            if (router.mac.trim().toLowerCase() === macIp.mac.trim().toLowerCase()) {
                routersIps.push({ id: router.id, name: router.name, mac: macIp.mac, ip: macIp.ip })
            }
        })
    });

    console.log(`FOUND ${routersIps.length} ONLINE ROUTERS`);
    return routersIps;
};

module.exports = { getDataFromRouterAndSave, getRouterIps, getMacByIps };