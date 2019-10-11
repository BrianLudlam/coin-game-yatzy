const CoinGameYatzy = artifacts.require("CoinGameYatzy");
const YatzyGameAddress = '0xA0D58ACBD4526371E182068F33d3493Df387585c';
const YatzyCoinAddress = '0x6aF05d36142C0d9c6B246E38389d28C96711E153';
module.exports = function(deployer) {
  deployer.deploy(CoinGameYatzy, YatzyGameAddress, YatzyCoinAddress);
};
