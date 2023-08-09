const serialport = require('serialport');

const port = new serialport('/dev/ttyAMA0', { baudRate: 9600 });
const Readline = serialport.parsers.Readline;
const parser = new Readline();

port.pipe(parser);

const ping = async () => {
    console.log(`GETTING LATEST PLANTS REPORTS FROM DB`);
    parser.on('data', (data) => console.log("-----------data: ", data));
    port.write('PING');
    
}

module.exports = { ping };