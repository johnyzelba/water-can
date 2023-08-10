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
            
            parser.on('data', (data) => {
                console.log("----");
                res(JSON.parse(data))
            });
            port.write('PING');
        });
        port.on('error', function (err) {
            if (err) {
                rej('Error: ', err.message);
            }
        });
    });
}

module.exports = { ping };