import {
    MAX_LITERS_IN_WATER_CAN, MS_TO_DOSE_ONE_ML, LITERS_TO_POT_SIZE_RATIO, MAX_DISTANCE_FROM_SENSOR_IN_CM, MIN_DISTANCE_FROM_SENSOR_IN_CM,
    WATERSELANOIDPIN, NITROGENPUMPPIN, PHOSPHORUSPUMPPIN, POTASSIUMPUMPPIN, STIRRERPIN, DEBUGING
} from '../utils/consts';
import { Gpio }  from 'onoff';
import { RequestTypes , getDataFromArduino } from './arduino';

const waterSelanoid = new Gpio(WATERSELANOIDPIN, 'out');
const nitrogenPump = new Gpio(NITROGENPUMPPIN, 'out');
const phosphorusPump = new Gpio(PHOSPHORUSPUMPPIN, 'out');
const potassiumPump = new Gpio(POTASSIUMPUMPPIN, 'out');
const stirrer = new Gpio(STIRRERPIN, 'out');

nitrogenPump.writeSync(1);
phosphorusPump.writeSync(1);
potassiumPump.writeSync(1);
stirrer.writeSync(1);
waterSelanoid.writeSync(1);

const getDistance = async (): Promise<number> => {
    const response: { distanceA: number, distanceB: number} = await getDataFromArduino(RequestTypes.DISTANCE);
    if (DEBUGING) {
        console.log("DEBUGING: DISTANCES: ", response.distanceA, " | ", response.distanceB);
    }
    if (!response.distanceA || !response.distanceB ) {
        throw "SOMETHING'S WRONG! (no response from distance sensors)";
    }
    if (Math.abs(response.distanceA - response.distanceB) > 3) {
        throw "SOMETHING'S WRONG! (delta between distance sensors is to high)";
    }
    // set time out is used to enforce wait between calls to sensor (sensonr restriction)
    return await new Promise((res) => setTimeout(() => res((response.distanceA + response.distanceB) / 2), 2000));
}

export const validateWaterCan = async () => {
    console.log("VALIDATING WATER CAN");
    if (!(await isWaterCanInPlace())) {
        throw "WATER CAN NOT IN PLACE";
    }
    if (!(await isWaterCanEnmpty())) {
        throw "WATER CAN NOT EMPTY";
    }
    if (!(await isWaterFlowing())) {
        throw "SOMETHING'S WRONG (WATER FLOW)! water is flowing abefore task started";
    }
    console.log("WATER CAN IS VALID");
};

const isWaterCanInPlace = async () => {
    console.log(`CHECKING IF WATER CAN IS IN PLACE`);
    const response: { success: boolean, info?: string } | undefined = await getDataFromArduino(RequestTypes.RFID).catch(e => ({ success: false, info: e }));
    if (DEBUGING) {
        console.log("DEBUGING: RFID RES: ", response);
    }
    return response?.success;
};

const isWaterCanEnmpty = async () => {
    console.log(`CHECKING IF WATER CAN IS EMPTY`);
    return (await getAmountOfLiquidInWaterCan()) === 0;
};

export const isWaterFlowing = async () => {
    console.log(`CHECKING IF WATER IF FLOWING`);
    const response: { flow: 1 | 0 } = await getDataFromArduino(RequestTypes.FLOW);
    if (DEBUGING) {
        console.log("DEBUGING: WATER FLOW: ", response.flow);
    }

    return response.flow == 0;
};

const getAmountOfLiquidInWaterCan = async (): Promise<number> => {
        console.log(`CHECKING THE AMOUNT OF LIQUID IN THE WATER CAN`);
        const distance = await getDistance();
        const normalisedDistanceToRatio = (distance - MAX_DISTANCE_FROM_SENSOR_IN_CM) / (MIN_DISTANCE_FROM_SENSOR_IN_CM - MAX_DISTANCE_FROM_SENSOR_IN_CM);
        const amountOfLiquidInWaterCan = normalisedDistanceToRatio * MAX_LITERS_IN_WATER_CAN; 
        return amountOfLiquidInWaterCan;
};

export const fillWaterCan = async (potSize) => {
    console.log(`FILLING WATER CAN WITH WATER`);
    const neededAmountOfWaterInLiters = calcNeededAmountOfWaterInLiters(potSize);
    const startTime = new Date();
    let currentTime = new Date();
    let diffMins = 0;
    let amountOfLiquidInWaterCanArr = [(await getAmountOfLiquidInWaterCan())];
    let iterations = 0;

    while (amountOfLiquidInWaterCanArr[iterations] < neededAmountOfWaterInLiters || diffMins < 5) {
        waterSelanoid.writeSync(0);

        await new Promise((res) => setTimeout(() => res(true), 100));
        if (!isWaterFlowing()) {
            throw "SOMETHING'S WRONG (WATER FLOW)! water is not flowing and should"; 
        }

        await new Promise((res) => setTimeout(() => res(waterSelanoid.writeSync(1)), 10000));

        await new Promise((res) => setTimeout(() => res(true), 100));
        if (isWaterFlowing()) {
            throw "SOMETHING'S WRONG (WATER FLOW)! water is flowing and should not";
        }

        currentTime = new Date();
        diffMins = Math.round((((currentTime.getTime() - startTime.getTime()) % 86400000) % 3600000) / 60000);
        amountOfLiquidInWaterCanArr.push(await getAmountOfLiquidInWaterCan());
        iterations++;

        if (amountOfLiquidInWaterCanArr[iterations] <= amountOfLiquidInWaterCanArr[iterations - 1]) {
            waterSelanoid.writeSync(1);
            throw "SOMETHING'S WRONG (WATER FLOW)! water can not filling up";
        }
    }

    console.log(`FILLED WATER CAN WITH WATER SUCCESSFULLY`);
    return;
};

export const resetWaterValve = async () => {
    waterSelanoid.writeSync(0);
    await new Promise((res) => setTimeout(() => res(waterSelanoid.writeSync(1)), 10)); 
};

export const addNutritions = async (potSize, nitrogen, phosphorus, potassium) => {
    console.log(`ADDING NUTRIENTS TO WATER CAN`);
    const neededAmountOfWaterInLiters = calcNeededAmountOfWaterInLiters(potSize);
    const neededNitrogen = nitrogen * neededAmountOfWaterInLiters;
    const neededPhosphorus = phosphorus * neededAmountOfWaterInLiters;
    const neededPotassium = potassium * neededAmountOfWaterInLiters;

    nitrogenPump.writeSync(0);
    await new Promise((res) => setTimeout(() => res(nitrogenPump.writeSync(1)), neededNitrogen * MS_TO_DOSE_ONE_ML));

    phosphorusPump.writeSync(0);
    await new Promise((res) => setTimeout(() => res(phosphorusPump.writeSync(1)), neededPhosphorus * MS_TO_DOSE_ONE_ML));

    potassiumPump.writeSync(0);
    await new Promise((res) => setTimeout(() => res(potassiumPump.writeSync(1)), neededPotassium * MS_TO_DOSE_ONE_ML));
    await new Promise((res) => setTimeout(() => res(stirrer.writeSync(1)), 5000));

    console.log(`STIRRING WATER CAN`);
    stirrer.writeSync(0);
    const tempArr = new Array(80).fill('');
    for (let _ of tempArr) {
        await new Promise((res) => setTimeout(() => res(stirrer.writeSync(1)), 60));
        await new Promise((res) => setTimeout(() => res(stirrer.writeSync(0)), 500));
    }
    stirrer.writeSync(1);

    console.log(`ADDED NUTRITIONS SUCCESSFULLY`);
    return;
};

const calcNeededAmountOfWaterInLiters = (potSize) => {
    const litersPerPot = potSize / LITERS_TO_POT_SIZE_RATIO;
    return Math.min(litersPerPot, MAX_LITERS_IN_WATER_CAN);
};