const socket = io();
let isPaused = false;
let eventCount = { ENS: 0, ERC20: 0, total: 0 };
let totalValue = 0;

// Update stats
function updateStats() {
    document.getElementById('ens-count').textContent = eventCount.ENS;
    document.getElementById('transfer-count').textContent = eventCount.ERC20;
    document.getElementById('total-value').textContent = `${totalValue.toFixed(2)} ETH`;
}

// Format address for display
function formatAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Create and append event element
function createEventElement(data) {
    if (isPaused) return;

    const list = document.getElementById('events-list');
    const item = document.createElement('li');
    item.className = `event-item ${data.type.toLowerCase()}`;

    // Update counts
    if (data.type === 'ENS_Registration') {
        eventCount.ENS++;
        item.innerHTML = `
            <div class="event-header">
                <span class="event-type">ENS Registration</span>
                <span class="event-time">${new Date(data.timestamp).toLocaleString()}</span>
            </div>
            <div class="event-details">
                <p>Name: <strong>${data.name}</strong></p>
                <p>Owner: <span class="address">${formatAddress(data.owner)}</span></p>
            </div>
            <div class="event-footer">
                <a href="https://etherscan.io/tx/${data.transactionHash}" target="_blank" class="tx-link">View on Etherscan</a>
                <button class="copy-btn" data-address="${data.owner}">Copy Address</button>
            </div>
        `;
    } else if (data.type === 'ERC20_Transfer') {
        eventCount.ERC20++;
        totalValue += Number(data.value);
        item.innerHTML = `
            <div class="event-header">
                <span class="event-type">Token Transfer</span>
                <span class="event-time">${new Date(data.timestamp).toLocaleString()}</span>
            </div>
            <div class="event-details">
                <p>Token: <strong>${data.token.symbol}</strong></p>
                <p>Value: <strong>${Number(data.value).toFixed(2)}</strong></p>
                <p>From: <span class="address">${formatAddress(data.from)}</span></p>
                <p>To: <span class="address">${formatAddress(data.to)}</span></p>
            </div>
            <div class="event-footer">
                <a href="https://etherscan.io/tx/${data.transactionHash}" target="_blank" class="tx-link">View on Etherscan</a>
                <button class="copy-btn" data-address="${data.to}">Copy Address</button>
            </div>
        `;
    }

    // Add to list and update stats
    list.insertBefore(item, list.firstChild);
    updateStats();

    // Trim list if needed
    const maxEvents = parseInt(document.getElementById('limit-select').value);
    while (list.children.length > maxEvents) {
        list.removeChild(list.lastChild);
    }
}

// Socket event handlers
socket.on('connect', () => {
    document.getElementById('connection-status').className = 'connected';
    document.getElementById('connection-status').textContent = 'Connected';
});

socket.on('disconnect', () => {
    document.getElementById('connection-status').className = 'disconnected';
    document.getElementById('connection-status').textContent = 'Disconnected';
});

socket.on('activity', (data) => {
    console.log('Received activity:', data); // Debug log
    createEventElement(data);
});

// Initialize copy buttons
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-btn')) {
        const address = e.target.dataset.address;
        navigator.clipboard.writeText(address).then(() => {
            e.target.textContent = 'Copied!';
            setTimeout(() => {
                e.target.textContent = 'Copy Address';
            }, 2000);
        });
    }
});

// Filter events
function filterEvents(type) {
    const events = document.querySelectorAll('.event-item');
    events.forEach(event => {
        if (type === 'all' || event.classList.contains(type.toLowerCase())) {
            event.style.display = 'block';
        } else {
            event.style.display = 'none';
        }
    });
}

// Update gas price periodically
async function updateGasPrice() {
    try {
        const response = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle');
        const data = await response.json();
        if (data.status === '1') {
            document.getElementById('gas-price').textContent = 
                `Gas: ${data.result.SafeGasPrice} gwei`;
        }
    } catch (error) {
        console.error('Error fetching gas price:', error);
    }
}

// Initial setup
updateGasPrice();
setInterval(updateGasPrice, 30000); // Update every 30 seconds
