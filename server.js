require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Web3 } = require("web3");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Constants
const ENS_CONTRACT_ADDRESS = '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85';
const ERC20_ABI = [
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "from", "type": "address"},
            {"indexed": true, "name": "to", "type": "address"},
            {"indexed": false, "name": "value", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
];

const ENS_ABI = [
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "owner", "type": "address"},
            {"indexed": true, "name": "label", "type": "bytes32"},
            {"indexed": false, "name": "name", "type": "string"}
        ],
        "name": "NameRegistered",
        "type": "event"
    }
];

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const WS_ENDPOINT = `wss://mainnet.infura.io/ws/v3/${INFURA_API_KEY}`;

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const COINMARKETCAP_API_URL = 'https://pro-api.coinmarketcap.com/v1';

// Serve static files from public directory
app.use(express.static('public'));

// Initialize Web3
const web3 = new Web3(WS_ENDPOINT);

const cmc = new CoinMarketCapService(process.env.COINMARKETCAP_API_KEY);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

async function getTokenPrice(symbol) {
    try {
        const response = await axios.get(`${COINMARKETCAP_API_URL}/cryptocurrency/quotes/latest`, {
            headers: {
                'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY
            },
            params: {
                symbol: symbol
            }
        });
        
        if (response.data.data[symbol]) {
            return response.data.data[symbol].quote.USD.price;
        }
        return null;
    } catch (error) {
        console.error('Error fetching token price:', error);
        return null;
    }
}

async function startTrackers() {
    // Track ENS events
    const ensContract = new web3.eth.Contract(ENS_ABI, ENS_CONTRACT_ADDRESS);
    ensContract.events.NameRegistered({
        fromBlock: 'latest'
    })
    .on('data', async (event) => {
        console.log('ENS event received:', event);
        try {
            const block = await web3.eth.getBlock(event.blockNumber);
            const timestamp = new Date(block.timestamp * 1000);
            
            const eventData = {
                type: 'ENS_Registration',
                timestamp: timestamp.toISOString(),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber,
                name: event.returnValues.name,
                owner: event.returnValues.owner
            };

            io.emit('activity', eventData);
            console.log('New ENS registration:', eventData);
        } catch (error) {
            console.error('Error processing ENS event:', error);
        }
    })
    .on('error', console.error);

    // Track ERC20 transfers
    const transferTopic = web3.utils.sha3('Transfer(address,address,uint256)');
    const subscription = await web3.eth.subscribe('logs', {
        topics: [transferTopic]
    });

    subscription.on('data', async (event) => {
        console.log('ERC20 event received:', event);
        try {
            // Decode transfer event
            const decodedLog = web3.eth.abi.decodeLog([
                { type: 'address', name: 'from', indexed: true },
                { type: 'address', name: 'to', indexed: true },
                { type: 'uint256', name: 'value', indexed: false }
            ], event.data, [event.topics[1], event.topics[2]]);

            // Get token details
            const tokenContract = new web3.eth.Contract(ERC20_ABI, event.address);
            let symbol = 'Unknown';
            let decimals = 18;

            try {
                [symbol, decimals] = await Promise.all([
                    tokenContract.methods.symbol().call(),
                    tokenContract.methods.decimals().call()
                ]);
            } catch (error) {
                console.log('Error getting token details:', error);
            }

            const value = web3.utils.fromWei(decodedLog.value, 'ether');
            
            // Get token price
            const price = await cmc.getTokenPrice(symbol);
            const usdValue = price ? Number(value) * price : null;
            
            if (Number(value) > 10) {
                const block = await web3.eth.getBlock(event.blockNumber);
                const eventData = {
                    type: 'ERC20_Transfer',
                    timestamp: new Date(block.timestamp * 1000).toISOString(),
                    transactionHash: event.transactionHash,
                    token: {
                        address: event.address,
                        symbol,
                        decimals,
                        price: price ? price.toFixed(2) : null
                    },
                    from: decodedLog.from,
                    to: decodedLog.to,
                    value,
                    usdValue: usdValue ? usdValue.toFixed(2) : null,
                    blockNumber: event.blockNumber
                };

                io.emit('activity', eventData);
                console.log('New high-value token transfer:', eventData);
            }
        } catch (error) {
            console.error('Error processing ERC20 transfer:', error);
        }
    });

    // Monitor connection status
    web3.eth.net.isListening()
        .then(() => console.log('Connected to Ethereum network'))
        .catch(error => console.error('Connection error:', error));
}

// Start the trackers
startTrackers().catch(console.error);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startTrackers().catch(console.error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server shutdown complete');
        process.exit(0);
    });
});

// Add this near your other event handlers
io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Add new endpoints
app.get('/api/market/global', async (req, res) => {
    try {
        const data = await cmc.getGlobalMetrics();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch global metrics' });
    }
});

app.get('/api/market/trending', async (req, res) => {
    try {
        const data = await cmc.getTrendingTokens();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trending tokens' });
    }
});

app.get('/api/token/:symbol', async (req, res) => {
    try {
        const [price, metadata, marketPairs] = await Promise.all([
            cmc.getTokenPrice(req.params.symbol),
            cmc.getTokenMetadata(req.params.symbol),
            cmc.getMarketPairs(req.params.symbol)
        ]);
        res.json({ price, metadata, marketPairs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch token data' });
    }
});
