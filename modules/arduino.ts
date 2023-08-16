import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export enum RequestTypes {
    PING = "PING",
    DISTANCE = "DISTANCE",
    RFID = "RFID",
    FLOW = "FLOW"
};

export const getDataFromArduino = async (request: RequestTypes):Promise<any> => {
    console.log(`SENDING REQUEST TO ARDUINO: ${request}`);
    const port: any = new SerialPort({
        path: '/dev/ttyUSB0',
        baudRate: 9600,
    });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    return new Promise((res,rej) => {
        port.on('open', () => {
            setTimeout(() => port.write(request), 1500);
            setTimeout(() => rej('Time out'), 10000);
            parser.on('data', (data) => {
                port.close(function (err) {
                    if (err) {
                        rej(err.message);
                    }
                });
                res(JSON.parse(data))
            });
        });
        port.on('error', function (err) {
            rej(err.message);
        });
    });
};