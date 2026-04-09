const StellarSdk = require('@stellar/stellar-sdk');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { Horizon, Keypair } = StellarSdk;
const horizon = new Horizon.Server(process.env.HORIZON_URL || "https://horizon-testnet.stellar.org");
const oracleKp = Keypair.fromSecret(process.env.ORACLE_SK);

async function check() {
    console.log('Oracle Public Key:', oracleKp.publicKey());
    try {
        const account = await horizon.loadAccount(oracleKp.publicKey());
        console.log('Account loaded successfully');
        console.log('Balances:', JSON.stringify(account.balances, null, 2));
    } catch (e) {
        if (e.response && e.response.status === 404) {
            console.log('Account NOT FOUND on testnet. Funding now...');
            try {
                const fundRes = await fetch(`https://friendbot.stellar.org?addr=${oracleKp.publicKey()}`);
                const text = await fundRes.text();
                console.log('Friendbot response:', text);
            } catch (fe) {
                console.log('Friendbot failed:', fe.message);
            }
        } else {
            console.log('Error loading account:', e.message);
        }
    }
}
check();
