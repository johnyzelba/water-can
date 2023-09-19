import dotenv from 'dotenv'
dotenv.config();

// Env
export const DEBUGING = !!process.env.DEBUGING;
export const DB_PATH = process.env.DB_PATH;
export const TBTOKEN = process.env.TELEGRAM_TOKEN;
export const TBCHATID = process.env.TELEGRAM_CHAT_ID;

// General
export const SOIL_MOISTURE_WATERING_THRESHOLD = 15;
export const MAX_LITERS_IN_WATER_CAN = 2;
export const MS_TO_DOSE_ONE_ML = 300;
export const LITERS_TO_POT_SIZE_RATIO = 0.4;
export const MAX_DISTANCE_FROM_SENSOR_IN_CM = 30;
export const MIN_DISTANCE_FROM_SENSOR_IN_CM = 1; // todo: real value

// Pinout
export const WATERSELANOIDPIN = 23;
export const NITROGENPUMPPIN = 24;
export const PHOSPHORUSPUMPPIN = 25;
export const POTASSIUMPUMPPIN = 16;
export const STIRRERPIN = 17;