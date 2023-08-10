const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')


const ping = async () => {
    const port = new SerialPort({
        path: '/dev/ttyUSB0',
        baudRate: 9600,
    });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }))

    console.log(`PINGING ARDUINO`);
    port.on('open', () => {
        port.write('PING\n');
        setInterval(() => port.write('PING\n'), 1000);
        parser.on('data', (data) => console.log("-----------data: ", data));
    });
    port.on('error', function (err) {
        console.log('Error: ', err.message);
    });
}

module.exports = { ping };