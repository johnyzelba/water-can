const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')



const ping = async () => {
    console.log(`PINGING ARDUINO`);
    const port = new SerialPort({
        path: '/dev/ttyUSB0',
        baudRate: 9600,
    });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    console.log("---------------1");

    return new Promise((res,rej) => {
        port.on('open', () => {
            setInterval(() => port.write('PING'), 1000);
            console.log("---------------2");

            parser.on('data', (data) => {
                console.log("---------------", data);
                console.log("---------------", JSON.parse(data));
                res(JSON.parse(data))
            });
            port.write('PING');
            port.write('PING');
            port.write('PING');
        });
        port.on('error', function (err) {
            rej('Error: ', err.message);
        });
    });
}

module.exports = { ping };