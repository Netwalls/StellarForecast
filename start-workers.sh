#!/bin/zsh

echo "Starting data-feed on port 4001..."
cd data-feed
npm run start &
DATA_FEED_PID=$!

echo "Starting oracle..."
cd ../oracle
npm run start &
ORACLE_PID=$!

function cleanup {
    echo "Stopping workers..."
    kill $DATA_FEED_PID
    kill $ORACLE_PID
}

trap cleanup EXIT

echo "Workers started successfully. Press Ctrl+C to stop."
wait
