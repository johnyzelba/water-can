
const { MS_TO_DOSE_ONE_ML, LITERS_TO_POT_SIZE_RATIO, MAX_LITERS_IN_WATER_CAN, MAX_DISTANCE_FROM_SENSOR_IN_CM, MIN_DISTANCE_FROM_SENSOR_IN_CM } = require('../utils/consts');
const triggerPin = new Gpio(48, 'out');
triggerPin.writeSync(0);
const echoPin = new Gpio(60, 'in');

const getDistance = () => {
    triggerPin.writeSync(1);
    sleepSync(1000);
    triggerPin.writeSync(0);

    let startTimeMs = hrtime.bigint();
    let endTimeMs = hrtime.bigint();

    while (echoPin.readSync() === 0) {
        startTimeMs = hrtime.bigint();
    }

    while (echoPin.readSync() === 1) {
        endTimeMs = hrtime.bigint();
    }

    const deltaTime = Number(endTimeMs - startTimeMs) / 1000000000;

    // multiply with the sonic speed (34300 cm/s)
    // and divide by 2, because there and back
    return (deltaTime * 34300) / 2;
}

const validateWaterCan = async () => {
    console.log("VALIDATING WATER CAN");
    if (!(await isWaterCanInPlace())) {
        throw "WATER CAN NOT IN PLACE";
    }
    if (!(await isWaterCanEnmpty())) {
        throw "WATER CAN NOT EMPTY";
    }
    if (!(await getFlowAmount())) {
        throw "WATER IS FLOWING BEFORE TASK STARTED";
    }
    console.log("WATER CAN IS VALID");
};

const isWaterCanInPlace = async () => {
    console.log(`CHECKING IF WATER CAN IS IN PLACE`);
    return (await getAmountOfLiquidInWaterCan()) >= 0;
};

const isWaterCanEnmpty = async () => {
    console.log(`CHECKING IF WATER CAN IS EMPTY`);
    return (await getAmountOfLiquidInWaterCan()) === 0;
};

const getAmountOfLiquidInWaterCan = async () => {
    await (async () => {
        while (true) {
            console.log(`CHECKING THE AMOUNT OF LIQUID IN THE WATER CAN`);
            const distance = getDistance();
            console.log('Distance: ' + distance);
            const normalisedDistanceToRatio = (distance - MAX_DISTANCE_FROM_SENSOR_IN_CM) / (MIN_DISTANCE_FROM_SENSOR_IN_CM - MAX_DISTANCE_FROM_SENSOR_IN_CM);
            console.log('normalisedDistanceToRatio: ' + normalisedDistanceToRatio);

            const amountOfLiquidInWaterCan = normalisedDistanceToRatio * MAX_LITERS_IN_WATER_CAN;
            console.log('amountOfLiquidInWaterCan: ' + amountOfLiquidInWaterCan);
            console.log(`---------------------------------------------`);
            await new Promise((res) =>  setTimeout(() => res(true), 2000))
        }
    })();
    // return amountOfLiquidInWaterCan;
};

const getFlowAmount = async () => {
    console.log(`CHECKING THE AMOUNT OF FLOWING WATER`);
    return await waterFlow.readSync();
};

const fillWaterCan = async (potSize) => {
    console.log(`FILLING WATER CAN WITH WATER`);
    const neededAmountOfWaterInLiters = calcNeededAmountOfWaterInLiters(potSize);
    const startTime = new Date();
    let currentTime = new Date();
    let diffMins = 0;
    let amountOfLiquidInWaterCanArr = [(await getAmountOfLiquidInWaterCan())];
    let iterations = 0;

    while (amountOfLiquidInWaterCanArr[iterations] < neededAmountOfWaterInLiters || diffMins < 5) {
        waterSelanoid.writeSync(0);
        await new Promise((res) => setTimeout(() => res(waterSelanoid.writeSync(1)), 5000));
        currentTime = new Date();
        diffMins = Math.round((((currentTime - startTime) % 86400000) % 3600000) / 60000);
        amountOfLiquidInWaterCanArr.push(await getAmountOfLiquidInWaterCan());
        iterations++;

        if (amountOfLiquidInWaterCanArr[iterations] <= amountOfLiquidInWaterCanArr[iterations - 1]) {
            waterSelanoid.writeSync(1);
            throw "SOMETHING'S WRONG!";
        }
    }
    console.log(`FILLED WATER CAN WITH WATER SUCCESSFULLY`);

    return;
};

const resetWaterValve = async () => {
    waterSelanoid.writeSync(0);
    await new Promise((res) => setTimeout(() => res(waterSelanoid.writeSync(1)), 10)); 
};

const addNutritions = async (potSize, nitrogen, phosphorus, potassium) => {
    console.log(`ADDING NUTRIENTS TO WATER CAN`);
    const neededAmountOfWaterInLiters = calcNeededAmountOfWaterInLiters(potSize);
    const neededNitrogen = nitrogen * neededAmountOfWaterInLiters;
    const neededPhosphorus = phosphorus * neededAmountOfWaterInLiters;
    const neededPotassium = potassium * neededAmountOfWaterInLiters;

    console.log(`STIRRING WATER CAN`);
    stirrer.writeSync(0);

    nitrogenPump.writeSync(0); waterFlow
    await new Promise((res, rej) => setTimeout(() => res(nitrogenPump.writeSync(1)), neededNitrogen * MS_TO_DOSE_ONE_ML));

    phosphorusPump.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(phosphorusPump.writeSync(1)), neededPhosphorus * MS_TO_DOSE_ONE_ML));

    potassiumPump.writeSync(0);
    await new Promise((res, rej) => setTimeout(() => res(potassiumPump.writeSync(1)), neededPotassium * MS_TO_DOSE_ONE_ML));
    await new Promise((res, rej) => setTimeout(() => res(stirrer.writeSync(1)), 30000));

    console.log(`ADDED NUTRITIONS SUCCESSFULLY`);

    return;
};

const calcNeededAmountOfWaterInLiters = (potSize) => {
    const litersPerPot = potSize / LITERS_TO_POT_SIZE_RATIO;
    return litersPerPot < MAX_LITERS_IN_WATER_CAN ? litersPerPot : MAX_LITERS_IN_WATER_CAN;
}

module.exports = { validateWaterCan, fillWaterCan, addNutritions, resetWaterValve, getFlowAmount };
