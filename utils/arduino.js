const { SerialPort } = require('serialport');

const port = new SerialPort({
    path: '/dev/ttyAMA0',
    baudRate: 19200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    parser: SerialPort.parsers.readline('\n')
});

const ping = async () => {
    console.log(`GETTING LATEST PLANTS REPORTS FROM DB`);
    port.on('data', (data) => console.log("-----------data: ", data));
    port.write('PING');
    
}

module.exports = { ping };