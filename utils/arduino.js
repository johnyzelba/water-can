const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')



const ping = async () => {
    console.log(`PINGING ARDUINO`);
    const port = new SerialPort({
        path: '/dev/ttyUSB0',
        baudRate: 9600,
    });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    return new Promise((res,rej) => {
        port.on('open', () => {
            port.write('PINGPING');
            setTimeout(() => port.write('PING'), 1000);
            parser.on('data', (data) => {
                res(JSON.parse(data))
            });
        });
        port.on('error', function (err) {
            rej('Error: ', err.message);
        });
    });
}

module.exports = { ping };