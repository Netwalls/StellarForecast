const StellarSdk = require('@stellar/stellar-sdk');
const asset = new StellarSdk.Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
console.log("Expected derived contract:", asset.contractId(StellarSdk.Networks.TESTNET));
