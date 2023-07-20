const MICROSECDONDS_PER_CM = 1e6 / 34321;
const SOIL_MOISTURE_WATERING_THRESHOLD = 15;
const MAX_LITERS_IN_WATER_CAN = 2;
const MS_TO_DOSE_ONE_ML = 300;
const LITERS_TO_POT_SIZE_RATIO = 0.4;
const MAX_DISTANCE_FROM_SENSOR_IN_CM = 32;
const MIN_DISTANCE_FROM_SENSOR_IN_CM = 1;

module.exports = { 
    MICROSECDONDS_PER_CM, 
    SOIL_MOISTURE_WATERING_THRESHOLD, 
    MAX_LITERS_IN_WATER_CAN,
    MS_TO_DOSE_ONE_ML,
    LITERS_TO_POT_SIZE_RATIO,
    MAX_DISTANCE_FROM_SENSOR_IN_CM,
    MIN_DISTANCE_FROM_SENSOR_IN_CM
};
