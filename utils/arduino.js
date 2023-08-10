const { SerialPort } = require('serialport');



const ping = async () => {
    const port = new SerialPort({
        path: '/dev/ttyUSB0',
        baudRate: 9600,
    }, function (err) {
        console.log('Error: ', err.message);
    });
    console.log(`PINGING ARDUINO`);
    port.on('open', () => {
        port.write('PING', (e) => console.log("write e: ", e));
        port.on('data', (data) => console.log("-----------data: ", data));
    });
    port.on('error', function (err) {
        console.log('Error: ', err.message);
    });
}

module.exports = { ping };