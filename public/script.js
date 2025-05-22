// Modify the createEventElement function
function createEventElement(data) {
    // ... existing code ...

    if (data.type === 'ERC20_Transfer') {
        eventCount.ERC20++;
        totalValue += Number(data.value);
        
        const priceInfo = data.token.price ? 
            `<p>Price: $${data.token.price}</p>` : '';
        const usdValue = data.usdValue ? 
            `<p>USD Value: $${data.usdValue}</p>` : '';

        item.innerHTML = `
            <div class="event-header">
                <span class="event-type">Token Transfer</span>
                <span class="event-time">${new Date(data.timestamp).toLocaleString()}</span>
            </div>
            <div class="event-details">
                <p>Token: <strong>${data.token.symbol}</strong></p>
                <p>Value: <strong>${Number(data.value).toFixed(2)}</strong></p>
                ${priceInfo}
                ${usdValue}
                <p>From: <span class="address">${formatAddress(data.from)}</span></p>
                <p>To: <span class="address">${formatAddress(data.to)}</span></p>
            </div>
            <div class="event-footer">
                <a href="https://etherscan.io/tx/${data.transactionHash}" target="_blank" class="tx-link">View on Etherscan</a>
                <button class="copy-btn" data-address="${data.to}">Copy Address</button>
            </div>
        `;
    }
    // ... rest of the code ...
} 