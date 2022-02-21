// Start a mainnet node and stop it after thirty seconds
const nr = require('/app/lib');

const bitcoin = new nr.BTC({});

// Listen for events
bitcoin
  .on(nr.constants.NodeEvent.OUTPUT, console.log)
  .on(nr.constants.NodeEvent.ERROR, console.error)
  .on(nr.constants.NodeEvent.CLOSE, code => console.log(`Exited with code ${code}.`));

// Start node
bitcoin.start();

setTimeout(() => {
  bitcoin.stop()
    .then(() => console.log('Stopped!'))
    .catch(console.error);
}, 30000);
