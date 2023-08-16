import axios from 'axios';
import Evilscan from  'evilscan';
import { toMAC } from '@network-utils/arp-lookup'
import { getPlants } from  './plants';
import { createPlantsReports } from  './plantReports';

type RouterRow = { id: number, name: string, mac: string, ip: string };

const getRouters = async (db): Promise<Omit<RouterRow, 'ip'>[]> => {
    console.log(`GETTING ROUTERS FROM DB`);
    const routerRows: Omit<RouterRow, 'ip'>[] = await new Promise(function (resolve, reject) {
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

const scanIps = async (): Promise<any[]> => {
    const list: any[] = [];
    const options = {
        target: '192.168.2.1-192.168.255.255',
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
                reject(new Error(err));
            });
            evilscan.on('done', () => {
                console.log(`FOUND ${list.length}  IP ADDRESSES WITH OPEN PORT`);
                resolve(list);
            });

            evilscan.run();
        });
    } catch (error) {
        console.log(error);
        return [];
    }
};

export const getMacByIps = async (ipList): Promise<RouterRow[]> => {
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
        return [];
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

type DataFromRouter = {
    temperture: number,
    soilMoisture: number,
    soilConductivity: number,
    light: number,
    plantId: number
}

export const getDataFromRouterAndSave = async (db, routersWithIp): Promise<DataFromRouter[]> => {
    try {
        return (await db.serialize(async () => {
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
            }) || [];
            const isSaved = await createPlantsReports(db, dataToSave);

            return dataToSave;
        }));
    } catch (e) {
        console.log(e);
        return [];
    }
};

export const getRouterIps = async (db) => {
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

    const routersIps: RouterRow[] = []

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