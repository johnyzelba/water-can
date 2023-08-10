const { SerialPort } = require('serialport');

const port = new SerialPort({
    path: '/dev/ttyUSB0',
    baudRate: 9600,
});

const ping = async () => {
    try {
    console.log(`PINGING ARDUINO`);
    port.write('PING');
    port.on('data', (data) => console.log("-----------data: ", data));
    } catch(e) {
        console.log(e);
    }

}

module.exports = { ping };