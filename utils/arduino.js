const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')

const port = new SerialPort({
    path: '/dev/ttyUSB0',
    baudRate: 9600,
});
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

const ping = async () => {
    console.log(`PINGING ARDUINO`);
    return new Promise((res,rej) => {
        port.on('open', () => {
            port.write('PING');
            parser.on('data', (data) => {
                console.log("---------------", data);
                console.log("---------------", JSON.parse(data));
                res(JSON.parse(data))
            });
        });
        port.on('error', function (err) {
            rej('Error: ', err.message);
        });
    });
}

module.exports = { ping };