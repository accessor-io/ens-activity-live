const INFURA_PROJECT_ID = 'ff0db0391cc74735a160f2d7acae5ad4';
const ERC20_ABI = [
  // Transfer event ABI
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [],
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "from", "type": "address" },
      { "indexed": true, "name": "to", "type": "address" },
      { "indexed": false, "name": "value", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  }
];
const ENS_TOKEN_ADDRESS = '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85'; // Example ENS token address

const web3 = new Web3(`https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`);
const tokenContract = new web3.eth.Contract(ERC20_ABI, ENS_TOKEN_ADDRESS);

document.getElementById('subscribeButton').addEventListener('click', () => {
  subscribeToTransferEvents();
});

function subscribeToTransferEvents() {
  tokenContract.events.Transfer({
    fromBlock: 'latest'
  }, (error, event) => {
    if (error) {
      console.error('Error subscribing to events', error);
    } else {
      console.log('Event received', event);
      displayEvent(event);
    }
  });
}

function displayEvent(event) {
  const activityLog = document.getElementById('activityLog');
  const eventElement = document.createElement('p');
  eventElement.textContent = `Transfer from ${event.returnValues.from} to ${event.returnValues.to} of ${web3.utils.fromWei(event.returnValues.value, 'ether')} tokens.`;
  activityLog.appendChild(eventElement);
}
