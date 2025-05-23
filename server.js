const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Web3 = require("web3");
const CoinMarketCapService = require("./services/CoinMarketCapService");

// Initialize Web3
const web3 = new Web3(process.env.ETHEREUM_RPC_URL || "https://mainnet.infura.io/v3/YOUR_INFURA_KEY");

// Initialize CMC service
const cmcService = new CoinMarketCapService(process.env.CMC_API_KEY);

// ENS Registry ABI (minimal for our needs)
const ensRegistryABI = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "owner", "type": "address" },
            { "indexed": true, "name": "node", "type": "bytes32" },
            { "indexed": true, "name": "label", "type": "bytes32" },
            { "indexed": false, "name": "name", "type": "string" }
        ],
        "name": "NameRegistered",
        "type": "event"
    }
];

// ENS Registry address
const ENS_REGISTRY_ADDRESS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

// Statistics tracking
const stats = {
    totalEthTransferred: 0,
    ensTransfers: new Map(),
    lastUpdate: new Date()
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Initialize ENS Registry contract
const ensRegistry = new web3.eth.Contract(ensRegistryABI, ENS_REGISTRY_ADDRESS);

// Track ENS registrations
async function trackENSRegistrations() {
    try {
        const currentBlock = await web3.eth.getBlockNumber();
        
        ensRegistry.events.NameRegistered({ fromBlock: currentBlock - 1000 })
            .on('data', async (event) => {
                const eventData = {
                    type: 'ENS_Registration',
                    timestamp: new Date().toISOString(),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    name: event.returnValues.name,
                    owner: event.returnValues.owner
                };
                
                io.emit('activity', eventData);
            })
            .on('error', console.error);
    } catch (error) {
        console.error('Error tracking ENS registrations:', error);
    }
}

// Track ETH transfers from ENS addresses
async function trackETHTransfers() {
    try {
        const currentBlock = await web3.eth.getBlockNumber();
        
        web3.eth.subscribe('logs', {
            fromBlock: currentBlock,
            topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'] // Transfer event signature
        }, async (error, event) => {
            if (error) {
                console.error('Error in transfer subscription:', error);
                return;
            }

            try {
                const tx = await web3.eth.getTransaction(event.transactionHash);
                const receipt = await web3.eth.getTransactionReceipt(event.transactionHash);
                
                // Get ENS name if available
                let ensName = null;
                try {
                    ensName = await web3.eth.ens.getName(tx.from);
                } catch (e) {
                    // No ENS name found
                }

                if (ensName) {
                    const value = web3.utils.fromWei(tx.value, 'ether');
                    stats.totalEthTransferred += Number(value);
                    stats.ensTransfers.set(ensName, (stats.ensTransfers.get(ensName) || 0) + Number(value));

                    const eventData = {
                        type: 'ERC20_Transfer',
                        timestamp: new Date().toISOString(),
                        transactionHash: event.transactionHash,
                        blockNumber: event.blockNumber,
                        value: value,
                        token: {
                            symbol: 'ETH',
                            price: await cmcService.getTokenPrice('ETH')
                        },
                        ensName: ensName
                    };

                    io.emit('activity', eventData);
                    io.emit('stats', {
                        totalEthTransferred: stats.totalEthTransferred,
                        ensTransfers: Array.from(stats.ensTransfers.entries()),
                        lastUpdate: new Date()
                    });
                }
            } catch (error) {
                console.error('Error processing transfer:', error);
            }
        });
    } catch (error) {
        console.error('Error tracking ETH transfers:', error);
    }
}

// Start tracking
trackENSRegistrations();
trackETHTransfers();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    res.json({
        totalEthTransferred: stats.totalEthTransferred,
        ensTransfers: Array.from(stats.ensTransfers.entries()),
        lastUpdate: stats.lastUpdate
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Send initial stats to new connections
    socket.emit('stats', {
        totalEthTransferred: stats.totalEthTransferred,
        ensTransfers: Array.from(stats.ensTransfers.entries()),
        lastUpdate: stats.lastUpdate
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
}); 