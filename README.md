# Yatzy Coin Game

A smart contract implementation of the game Yatzy, which pays the user (per account) each game score in it's own ERC20 based currency, YatzyCoin. The contract utilizes an existing DiceGameYatzy contract, as well as a YatzyCoin (or YatzyCoinPlasma for Loom) contract for coinbase. 

TODO: elaborate more

## Deployment

The CoinGameYatzy contract can be deployed on Ethereum mainnet or testnet, side-chain, or compatible chain. Deployment requires address of deployed DiceGameYatzy contract and YatzyCoin (or YatzyCoinPlasma on Loom) contract.

Run `truffle compile` to compile, `truffle deploy` to deploy (default local chain).

## Testing 

Run `truffle test` for thorough testing.

## extdev-plasma-us1 Deployed Contract Address

0x294C5D489Fc84F82FD21cd8573988DB126ff219A

## DiceGameYatzy repo

https://github.com/BrianLudlam/dice-game-yatzy

## YatzyCoin repo

https://github.com/BrianLudlam/yatzy-coin