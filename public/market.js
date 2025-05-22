class MarketOverview {
    constructor() {
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.init();
    }

    async init() {
        await this.updateMarketData();
        setInterval(() => this.updateMarketData(), this.updateInterval);
    }

    async updateMarketData() {
        try {
            const [global, trending] = await Promise.all([
                fetch('/api/market/global').then(r => r.json()),
                fetch('/api/market/trending').then(r => r.json())
            ]);

            this.updateGlobalMetrics(global);
            this.updateTrendingTokens(trending);
        } catch (error) {
            console.error('Error updating market data:', error);
        }
    }

    updateGlobalMetrics(data) {
        const metricsContainer = document.getElementById('global-metrics');
        metricsContainer.innerHTML = `
            <div class="metric-card">
                <h3>Total Market Cap</h3>
                <span>$${this.formatNumber(data.quote.USD.total_market_cap)}</span>
            </div>
            <div class="metric-card">
                <h3>24h Volume</h3>
                <span>$${this.formatNumber(data.quote.USD.total_volume_24h)}</span>
            </div>
            <div class="metric-card">
                <h3>BTC Dominance</h3>
                <span>${data.btc_dominance.toFixed(2)}%</span>
            </div>
        `;
    }

    updateTrendingTokens(tokens) {
        const trendingContainer = document.getElementById('trending-tokens');
        trendingContainer.innerHTML = tokens.map(token => `
            <div class="token-card">
                <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/${token.id}.png" alt="${token.symbol}">
                <div class="token-info">
                    <h4>${token.name} (${token.symbol})</h4>
                    <p>$${token.quote.USD.price.toFixed(2)}</p>
                    <p class="${token.quote.USD.percent_change_24h >= 0 ? 'positive' : 'negative'}">
                        ${token.quote.USD.percent_change_24h.toFixed(2)}%
                    </p>
                </div>
            </div>
        `).join('');
    }

    formatNumber(num) {
        return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 0,
            notation: 'compact',
            compactDisplay: 'short'
        }).format(num);
    }
}

// Initialize market overview
new MarketOverview(); 