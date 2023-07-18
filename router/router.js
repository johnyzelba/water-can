const axios = require('axios/dist/node/axios.cjs');
const Evilscan = require('evilscan');
const { toMAC } = require('@network-utils/arp-lookup');

const { getPlants } = require('../utils/plants');
const { createPlantsReports } = require('../utils/plantReports');

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

const getDataFromRouterAndSave = async (db, routersWithIp) => {
    try {
        await db.serialize(async () => {
            const plants = await getPlants(db);
            const promises = routersWithIp.map(routerWithIp => getDataFromRouter(routerWithIp.ip));
            const responses = await Promise.all(promises);
            //TODO: apply for rest of array
            const response = responses[0];

            if (response.error) {
                throw response.error;
            }

            if (response.data && !response.data.length) {
                return false;
            }

            const dataToSave = response.data.map(dataElement => {
                const plantId = plants.filter(plant => plant.mac === dataElement.deviceId)[0].id;
                return ({
                    temperture: dataElement.temperture,
                    soilMoisture: dataElement.soilMoisture,
                    soilConductivity: dataElement.soilConductivity,
                    light: dataElement.light,
                    plantId
                })
            })
            const isSaved = await createPlantsReports(db, dataToSave);

            return isSaved ? dataToSave : false;
        });
    } catch (e) {
        console.log(e);
        return false;
    }
};

const getRouterIps = async (db) => {
    const ipScanRes = await scanIps();

    if (ipScanRes && !ipScanRes.length) {
        return false;
    }
    const macIpsList = await getMacByIps(ipScanRes);
    if (macIpsList && !macIpsList.length) {
        return false;
    }
    const routers = await getRouters(db);
    if (routers && !routers.length) {
        return false;
    }

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