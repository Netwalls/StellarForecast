const axios = require('axios');
const PK = 'GAOY4PVORH5LLKUYH4QYSS6MSAEBLDKFZYUWKSDVQTGN7OJEUKPTXF2G';

async function check() {
    try {
        const resp = await axios.get(`https://horizon-testnet.stellar.org/accounts/${PK}`);
        console.log('Account exists');
        console.log('Balances:', JSON.stringify(resp.data.balances, null, 2));
    } catch (e) {
        console.log('Account check failed:', e.message);
    }
}
check();
