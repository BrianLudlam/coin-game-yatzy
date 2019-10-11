/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like truffle-hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */
const fs = require('fs');
const path = require('path');

const ropstenAccountPath = path.join(__dirname, 'secret/ropsten_account')
const ropstenAccount = fs.readFileSync(ropstenAccountPath, 'utf-8')
const ropstenInfuraProvider = () => {
  const HDWalletProvider = require('truffle-hdwallet-provider');
  const infuraKeyPath = path.join(__dirname, 'secret/infura_key')
  const infuraKey = fs.readFileSync(infuraKeyPath, 'utf-8')
  const ropstenMnemonicPath = path.join(__dirname, 'secret/ropsten_mnemonic')
  const ropstenMnemonic = fs.readFileSync(ropstenMnemonicPath, 'utf-8')
  return new HDWalletProvider(
    ropstenMnemonic, `https://ropsten.infura.io/v3/${infuraKey}`,0,10);
}

const rinkebyAccountPath = path.join(__dirname, 'secret/rinkeby_account')
const rinkebyAccount = fs.readFileSync(rinkebyAccountPath, 'utf-8')
const rinkebyInfuraProvider = () => {
  const HDWalletProvider = require('truffle-hdwallet-provider');
  const infuraKeyPath = path.join(__dirname, 'secret/infura_key')
  const infuraKey = fs.readFileSync(infuraKeyPath, 'utf-8')
  const rinkebyMnemonicPath = path.join(__dirname, 'secret/rinkeby_mnemonic')
  const rinkebyMnemonic = fs.readFileSync(rinkebyMnemonicPath, 'utf-8')
  return new HDWalletProvider(
    rinkebyMnemonic, `https://rinkeby.infura.io/v3/${infuraKey}`,0,10);
}

const extdevAccountPath = path.join(__dirname, 'secret/extdev_account')
const extdevAccount = fs.readFileSync(extdevAccountPath, 'utf-8')
const extdevLoomProvider = () => {
  const LoomTruffleProvider = require ('loom-truffle-provider');
  const chainId = 'extdev-plasma-us1';
  const writeUrl = 'http://extdev-plasma-us1.dappchains.com:80/rpc';
  const readUrl = 'http://extdev-plasma-us1.dappchains.com:80/query';
  const extdevKeyPath = path.join(__dirname, 'secret/extdev_private_key')
  const extdevKey = fs.readFileSync(extdevKeyPath, 'utf-8')
  const provider = new LoomTruffleProvider(chainId, writeUrl, readUrl, extdevKey);
  provider.createExtraAccountsFromMnemonic(
    "grit square garment spell pizza mansion fence student slogan hire gospel visual", 10);
  return provider;
}


module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */
  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    
    //Local testing Ganache settings
    development: {
        host: "127.0.0.1",     // Localhost (default: none)
        port: 8545,            // Standard Ethereum port (default: none)
        network_id: "*",       // Any network (default: none)
        gas: 6000000,
        gasPrice: 5000000000,  // 5 gwei 
    },
    //Remote testing Ropsten settings
    ropsten: {
      provider: ropstenInfuraProvider,
      from: ropstenAccount,
      network_id: 3,       // Ropsten's id
      gas: 4000000,        // Ropsten has a lower block limit than mainnet
      confirmations: 5,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
    //Remote testing Rinkeby settings
    rinkeby: {
      provider: rinkebyInfuraProvider,
      from: rinkebyAccount,
      network_id: 4,
      gas: 4000000,
      gasPrice: 15000000001,
      confirmations: 5, 
      timeoutBlocks: 200, 
      skipDryRun: true
    },
    //Remote side-chain testing Loom extdev settings
    extdev_plasma_us1: {
      provider: extdevLoomProvider,
      network_id: '9545242630824'
    },
  },
  //Complier settings
  compilers: {
    solc: {
      version: '0.4.24',
      settings: {         
        optimizer: {
          enabled: true,
          runs: 10000
        }
      }
    }
  }
}
