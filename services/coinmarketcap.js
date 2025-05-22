const axios = require('axios');

class CoinMarketCapService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://pro-api.coinmarketcap.com/v1';
        this.headers = {
            'X-CMC_PRO_API_KEY': apiKey,
            'Accept': 'application/json'
        };
        // Cache to store prices (5 min expiry)
        this.priceCache = new Map();
    }

    // Get latest price for a token
    async getTokenPrice(symbol) {
        try {
            // Check cache first
            const cached = this.priceCache.get(symbol);
            if (cached && Date.now() - cached.timestamp < 300000) {
                return cached.price;
            }

            const response = await axios.get(`${this.baseUrl}/cryptocurrency/quotes/latest`, {
                headers: this.headers,
                params: { symbol }
            });

            if (response.data.data[symbol]) {
                const price = response.data.data[symbol].quote.USD.price;
                this.priceCache.set(symbol, {
                    price,
                    timestamp: Date.now()
                });
                return price;
            }
            return null;
        } catch (error) {
            console.error('Error fetching token price:', error?.response?.data || error.message);
            return null;
        }
    }

    // Get global crypto market data
    async getGlobalMetrics() {
        try {
            const response = await axios.get(`${this.baseUrl}/global-metrics/quotes/latest`, {
                headers: this.headers
            });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching global metrics:', error?.response?.data || error.message);
            return null;
        }
    }

    // Get trending tokens (top 10 by 24h volume)
    async getTrendingTokens() {
        try {
            const response = await axios.get(`${this.baseUrl}/cryptocurrency/listings/latest`, {
                headers: this.headers,
                params: {
                    limit: 10,
                    sort: 'volume_24h',
                    convert: 'USD'
                }
            });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching trending tokens:', error?.response?.data || error.message);
            return null;
        }
    }

    // Get token metadata
    async getTokenMetadata(symbol) {
        try {
            const response = await axios.get(`${this.baseUrl}/cryptocurrency/info`, {
                headers: this.headers,
                params: { symbol }
            });
            return response.data.data[symbol];
        } catch (error) {
            console.error('Error fetching token metadata:', error?.response?.data || error.message);
            return null;
        }
    }

    // Get market pairs for a token
    async getMarketPairs(symbol) {
        try {
            const response = await axios.get(`${this.baseUrl}/cryptocurrency/market-pairs/latest`, {
                headers: this.headers,
                params: {
                    symbol,
                    limit: 10
                }
            });
            return response.data.data.market_pairs;
        } catch (error) {
            console.error('Error fetching market pairs:', error?.response?.data || error.message);
            return null;
        }
    }
}

module.exports = CoinMarketCapService; 