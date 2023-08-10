const { SerialPort } = require('serialport');

const port = new SerialPort({
    path: '/dev/ttyAMA0',
    baudRate: 19200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
});
const Readline = SerialPort.parsers.Readline;
const parser = new Readline();

port.pipe(parser);

const ping = async () => {
    console.log(`GETTING LATEST PLANTS REPORTS FROM DB`);
    parser.on('data', (data) => console.log("-----------data: ", data));
    port.write('PING');
    
}

module.exports = { ping };