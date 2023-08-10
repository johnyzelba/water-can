const { SerialPort } = require('serialport');

const port = new SerialPort({
    path: '/dev/ttyUSB0',
    baudRate: 19200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
});

const ping = async () => {
    console.log(`PINGING ARDUINO`);
    port.on('data', (data) => console.log("-----------data: ", data));
    port.write('PING');
    
}

module.exports = { ping };