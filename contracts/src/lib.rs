#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    MarketCount,
    Market(u64),
    Bet(u64, Address),
}

// ─── Types ───────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MarketState {
    Open,
    Closed,   // past end_time, awaiting oracle
    Resolved,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Config {
    pub token: Address,   // USDC token contract
    pub oracle: Address,  // the AI oracle address
    pub oracle_fee_bps: u32, // oracle fee in basis points (e.g. 200 = 2%)
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Market {
    pub id: u64,
    pub creator: Address,
    pub question: String,
    pub end_time: u64,       // unix timestamp — betting closes
    pub yes_pool: i128,      // total USDC bet YES
    pub no_pool: i128,       // total USDC bet NO
    pub state: MarketState,
    pub outcome: u32,        // 0 = unresolved, 1 = YES, 2 = NO
    pub evidence_hash: String, // IPFS hash or URL of oracle evidence
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Bet {
    pub is_yes: bool,
    pub amount: i128,
    pub claimed: bool,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    MarketNotFound = 3,
    MarketNotOpen = 4,
    MarketNotClosed = 5,
    MarketNotResolved = 6,
    UnauthorizedOracle = 7,
    InvalidOutcome = 8,
    ZeroAmount = 9,
    BettingClosed = 10,
    AlreadyClaimed = 11,
    NoBet = 12,
    NotWinner = 13,
    EndTimePast = 14,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct PredictContract;

#[contractimpl]
impl PredictContract {
    // ── Admin ──────────────────────────────────────────────────────────────

    /// One-time setup. Call once after deploy.
    pub fn initialize(
        env: Env,
        token: Address,
        oracle: Address,
        oracle_fee_bps: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(
            &DataKey::Config,
            &Config { token, oracle, oracle_fee_bps },
        );
        env.storage().instance().set(&DataKey::MarketCount, &0u64);
        Ok(())
    }

    // ── Create Market ──────────────────────────────────────────────────────

    /// Anyone can create a market. end_time must be in the future.
    pub fn create_market(
        env: Env,
        creator: Address,
        question: String,
        end_time: u64,
    ) -> Result<u64, Error> {
        creator.require_auth();
        let cfg = Self::config(&env)?;
        let _ = cfg; // just validate it exists

        let now = env.ledger().timestamp();
        if end_time <= now {
            return Err(Error::EndTimePast);
        }

        let count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MarketCount)
            .unwrap_or(0);
        let id = count + 1;

        let market = Market {
            id,
            creator,
            question,
            end_time,
            yes_pool: 0,
            no_pool: 0,
            state: MarketState::Open,
            outcome: 0,
            evidence_hash: String::from_str(&env, ""),
        };

        env.storage().persistent().set(&DataKey::Market(id), &market);
        env.storage().instance().set(&DataKey::MarketCount, &id);

        Ok(id)
    }

    // ── Bet ────────────────────────────────────────────────────────────────

    /// Place a YES or NO bet. Transfers USDC from bettor to this contract.
    pub fn bet(
        env: Env,
        bettor: Address,
        market_id: u64,
        is_yes: bool,
        amount: i128,
    ) -> Result<(), Error> {
        bettor.require_auth();

        if amount <= 0 {
            return Err(Error::ZeroAmount);
        }

        let mut market = Self::load_market(&env, market_id)?;

        let now = env.ledger().timestamp();
        if market.state != MarketState::Open {
            return Err(Error::MarketNotOpen);
        }
        if now >= market.end_time {
            return Err(Error::BettingClosed);
        }

        // Transfer USDC from bettor to this contract
        let cfg = Self::config(&env)?;
        let token_client = token::Client::new(&env, &cfg.token);
        token_client.transfer(&bettor, &env.current_contract_address(), &amount);

        // Update pool
        if is_yes {
            market.yes_pool += amount;
        } else {
            market.no_pool += amount;
        }

        // Record bet (accumulate if they bet again)
        let bet_key = DataKey::Bet(market_id, bettor.clone());
        let existing: Option<Bet> = env.storage().persistent().get(&bet_key);
        let new_bet = match existing {
            Some(b) => Bet {
                is_yes,
                amount: b.amount + amount,
                claimed: false,
            },
            None => Bet { is_yes, amount, claimed: false },
        };

        env.storage().persistent().set(&bet_key, &new_bet);
        env.storage().persistent().set(&DataKey::Market(market_id), &market);

        Ok(())
    }

    // ── Resolve ────────────────────────────────────────────────────────────

    /// Oracle only. outcome: 1 = YES won, 2 = NO won.
    /// Oracle receives its fee from the losing pool.
    pub fn resolve(
        env: Env,
        market_id: u64,
        outcome: u32,
        evidence_hash: String,
    ) -> Result<(), Error> {
        let cfg = Self::config(&env)?;
        cfg.oracle.require_auth();

        if outcome != 1 && outcome != 2 {
            return Err(Error::InvalidOutcome);
        }

        let mut market = Self::load_market(&env, market_id)?;

        let now = env.ledger().timestamp();
        // Allow resolution only after betting closes
        if now < market.end_time && market.state == MarketState::Open {
            return Err(Error::MarketNotClosed);
        }
        if market.state == MarketState::Resolved {
            return Err(Error::MarketNotResolved);
        }

        let total_pool = market.yes_pool + market.no_pool;

        // Pay oracle fee from total pool
        if total_pool > 0 {
            let oracle_fee = (total_pool * cfg.oracle_fee_bps as i128) / 10_000;
            if oracle_fee > 0 {
                let token_client = token::Client::new(&env, &cfg.token);
                token_client.transfer(
                    &env.current_contract_address(),
                    &cfg.oracle,
                    &oracle_fee,
                );
            }
        }

        market.state = MarketState::Resolved;
        market.outcome = outcome;
        market.evidence_hash = evidence_hash;

        env.storage().persistent().set(&DataKey::Market(market_id), &market);

        Ok(())
    }

    // ── Claim ──────────────────────────────────────────────────────────────

    /// Winners call this to collect their proportional share of the pool.
    pub fn claim(env: Env, bettor: Address, market_id: u64) -> Result<i128, Error> {
        bettor.require_auth();

        let market = Self::load_market(&env, market_id)?;
        if market.state != MarketState::Resolved {
            return Err(Error::MarketNotResolved);
        }

        let bet_key = DataKey::Bet(market_id, bettor.clone());
        let mut bet: Bet = env
            .storage()
            .persistent()
            .get(&bet_key)
            .ok_or(Error::NoBet)?;

        if bet.claimed {
            return Err(Error::AlreadyClaimed);
        }

        // Check if bettor is on the winning side
        let won = (market.outcome == 1 && bet.is_yes) || (market.outcome == 2 && !bet.is_yes);
        if !won {
            return Err(Error::NotWinner);
        }

        let cfg = Self::config(&env)?;
        let oracle_fee = ((market.yes_pool + market.no_pool) * cfg.oracle_fee_bps as i128) / 10_000;
        let remaining_pool = market.yes_pool + market.no_pool - oracle_fee;

        let winning_pool = if market.outcome == 1 {
            market.yes_pool
        } else {
            market.no_pool
        };

        // Proportional payout: bettor_share / winning_pool * remaining_pool
        let payout = (bet.amount * remaining_pool) / winning_pool;

        bet.claimed = true;
        env.storage().persistent().set(&bet_key, &bet);

        let token_client = token::Client::new(&env, &cfg.token);
        token_client.transfer(&env.current_contract_address(), &bettor, &payout);

        Ok(payout)
    }

    // ── Read-only ──────────────────────────────────────────────────────────

    pub fn get_market(env: Env, market_id: u64) -> Option<Market> {
        env.storage().persistent().get(&DataKey::Market(market_id))
    }

    pub fn get_bet(env: Env, market_id: u64, bettor: Address) -> Option<Bet> {
        env.storage().persistent().get(&DataKey::Bet(market_id, bettor))
    }

    pub fn market_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::MarketCount).unwrap_or(0)
    }

    pub fn get_config(env: Env) -> Option<Config> {
        env.storage().instance().get(&DataKey::Config)
    }

    // ── Internal ───────────────────────────────────────────────────────────

    fn config(env: &Env) -> Result<Config, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    fn load_market(env: &Env, market_id: u64) -> Result<Market, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Market(market_id))
            .ok_or(Error::MarketNotFound)
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env, String,
    };

    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PredictContract, ());
        let token = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let oracle = Address::generate(&env);
        let user = Address::generate(&env);
        (env, contract_id, token.address(), oracle, user)
    }

    #[test]
    fn test_initialize() {
        let (env, cid, token, oracle, _) = setup();
        let client = PredictContractClient::new(&env, &cid);
        assert!(client.try_initialize(&token, &oracle, &200u32).is_ok());
        let cfg = client.get_config().unwrap();
        assert_eq!(cfg.oracle_fee_bps, 200);
    }

    #[test]
    fn test_create_market() {
        let (env, cid, token, oracle, user) = setup();
        let client = PredictContractClient::new(&env, &cid);
        client.initialize(&token, &oracle, &200u32);

        env.ledger().set_timestamp(1000);
        let id = client.create_market(
            &user,
            &String::from_str(&env, "Will BTC hit $100k?"),
            &2000u64,
        );
        assert_eq!(id, 1);
        let market = client.get_market(&1).unwrap();
        assert_eq!(market.state, MarketState::Open);
    }
}
