const truffleAssert = require('truffle-assertions');
const CoinGameYatzy = artifacts.require("CoinGameYatzy");
const IYatzyGame = artifacts.require("IYatzyGame");
const IYatzyCoin = artifacts.require("IYatzyCoin");
const YatzyGameAddress = '0xFd1e0Dff4Ec2ccbf8eFA1CC655c73F55482F0BCD';
const YatzyCoinAddress = '0xe50F289f6eFFA20604606D1912DcC0A58eB0E146';

const DICE_SIDES = 6;
const ROLL_COUNT = 5;
const VERIFY_BLOCKS = 1;

const BANK_COUNT = 6;
const BANK_ALL_FILTER = [5,5,5,5,5,5];
const BANK_NONE_FILTER = [0,0,0,0,0,0];

const TALLY_COUNT = 15;

let game;
let coin;
let coinGame;
let expectedEndBalance;

contract("CoinGameYatzy", (accounts) => {

  const owner = accounts[0];
  const alice = accounts[1];
  const aliceOp = accounts[2];
  const bob = accounts[3];

  const consoleLog = (msg) => { console.log ('LOG >>> ', msg); }

  beforeEach(async () => {
    coinGame = await CoinGameYatzy.new(YatzyGameAddress, YatzyCoinAddress, {from: owner});
    game = await IYatzyGame.at (YatzyGameAddress);
    coin = await IYatzyCoin.at (YatzyCoinAddress);
    expectedEndBalance = await coin.balanceOf(owner);
    //consoleLog ('start owner balance '+expectedEndBalance);
    await coin.transferFrom(owner, coinGame.address, "1000000");
  });

  afterEach(async () => {
    await coinGame.destroy({from: owner});
    const balance = await coin.balanceOf(owner);
    //consoleLog ('end owner balance '+balance);
    assert(balance.toString() === expectedEndBalance.toString());
  });

  it("should have a starting coin balance of 1 Mil", async () => {
      const balance = await coin.balanceOf(coinGame.address);
      assert(balance.toString() === "1000000");
  })

  it("should allow creating a table, sitting, and leaving", async () => {
    let tx;
    let tableId;
    let seat = 0;
    try{
      tx = await coinGame.createTable (1, 0, {from: alice});
      truffleAssert.eventEmitted(tx, 'TableCreated', (e) => (
        e.account.toString() === alice &&
        (tableId = e.tableId.toString()) !== "0"
      ));

      tx = await coinGame.takeSeat(tableId, seat, {from: alice});
      truffleAssert.eventEmitted(tx, 'PlayerSit', (e) => (
        e.account.toString() === alice &&
        e.tableId.toString() === tableId &&
        e.seat.toString() === seat.toString()
      ));

      tx = await coinGame.leaveSeat(tableId, seat, {from: alice});
      truffleAssert.eventEmitted(tx, 'PlayerLeave', (e) => (
        e.account.toString() === alice &&
        e.tableId.toString() === tableId &&
        e.seat.toString() === seat.toString()
      ));
    } catch(e) {
      assert(false, ''+e);
    }

  })

  it("should allow a random coin game", async () => {
  	const key = web3.utils.soliditySha3 (Date.now());
  	let tx;
  	let tally;
    let gameId;
  	try{
      const aliceStartBalance = await coin.balanceOf(alice);
      //consoleLog ('start alice balance '+aliceStartBalance);
  	  await coinGame.createTable (1, 0, {from: alice});
      await coinGame.takeSeat(1, 0, {from: alice});

      tx = await game.startGame(web3.utils.soliditySha3(key), {from: alice});
      truffleAssert.eventEmitted(tx, 'GameStarted', (e) => (
        e.account.toString() === alice &&
        (gameId = e.gameId.toString()) !== "0"
      ));

      tx = await coinGame.registerGame(1, 0, gameId, {from: alice});
      truffleAssert.eventEmitted(tx, 'PlayerGame', (e) => (
        e.account.toString() === alice &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === "0" &&
        e.gameId.toString() === gameId
      ));

  	  for (tally=0; tally<(TALLY_COUNT-1); tally++){
  	  	tx = await game.continueGame(
    	  key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, tally, {from: alice});
  	    truffleAssert.eventEmitted(tx, 'GameContinued', (e) => (
  	  	  e.account.toString() === alice && 
  	  	  e.turn.toString() === (tally+1).toString() && 
  	      e.tally.length === TALLY_COUNT && 
  	      parseInt(e.score.toString(), 10) === e.tally
  	      	.map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
  	      	.reduce((total, each) => total + each)
  	    ));  
    	  await setTimeout(() => {}, 100);
  	  }

  	  tx = await game.continueGame(
  	  	key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, TALLY_COUNT-1, {from: alice});
  	  truffleAssert.eventEmitted(tx, 'GameEnded', (e) => (
      		e.account.toString() === alice && 
        	e.tally.length === TALLY_COUNT && 
            parseInt(e.score.toString(), 10) === e.tally
    	      .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
    	      .reduce((total, each) => total + each)
    	));

      let reward;
      tx = await coinGame.claimGame(1, 0, gameId, {from: alice});
      truffleAssert.eventEmitted(tx, 'ScoreReward', (e) => (
        e.account.toString() === alice &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === "0" &&
        e.gameId.toString() === gameId &&
        (reward = e.reward.toString()) === e.score.toString() 
      ));
      
      consoleLog ('Alice Score: '+reward);
      expectedEndBalance -= reward;

      const aliceBalance = await coin.balanceOf(alice);
      //consoleLog ('end alice balance '+aliceBalance);
      assert((aliceBalance - aliceStartBalance).toString() === reward);

      await coinGame.leaveSeat(1, 0, {from: alice});

  	} catch(e) {
  	  tx = await game.abortGame({from: alice});
      assert(false, ''+e);
  	  truffleAssert.eventEmitted(tx, 'GameEnded', (e) => (
    		e.account.toString() === alice
  	  ));
  	  
  	}

  })

  it("should allow abort game", async () => {
    const key = web3.utils.soliditySha3 (Date.now());
    let gameId;
    let tx;
    try{
      await coinGame.createTable (1, 0, {from: alice});
      await coinGame.takeSeat(1, 0, {from: alice});
      tx = await game.startGame(web3.utils.soliditySha3(key), {from: alice});
      truffleAssert.eventEmitted(tx, 'GameStarted', (e) => (
        e.account.toString() === alice &&
        (gameId = e.gameId.toString()) !== "0"
      ));
      await coinGame.registerGame(1, 0, gameId, {from: alice});
      await game.continueGame(
        key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, 14, {from: alice});

      tx = await game.abortGame({from: alice});
      truffleAssert.eventEmitted(tx, 'GameEnded', (e) => (
        e.account.toString() === alice
      ));

      let reward;
      tx = await coinGame.claimGame(1, 0, gameId, {from: alice});
      truffleAssert.eventEmitted(tx, 'ScoreReward', (e) => (
        e.account.toString() === alice &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === "0" &&
        e.gameId.toString() === gameId &&
        (reward = e.reward.toString()) === e.score.toString()
      ));
      
      consoleLog ('Alice Score: '+reward);
      expectedEndBalance -= reward;

      await coinGame.leaveSeat(1, 0, {from: alice});

    } catch(e) {
      tx = await game.abortGame({from: alice});
      assert(false, ''+e);
      truffleAssert.eventEmitted(tx, 'GameEnded', (e) => (
        e.account.toString() === alice
      ));
        
    } 
  })

  it("should allow a VS game between alice and bob", async () => {
    const key = web3.utils.soliditySha3 (Date.now());
    let tx;
    let tally;
    let aliceGameId;
    let bobGameId;
    try{
      const aliceStartBalance = await coin.balanceOf(alice);
      const bobStartBalance = await coin.balanceOf(bob);
      //consoleLog ('start alice balance '+aliceStartBalance);
      await coinGame.createTable (2, 0, {from: alice});
      await coinGame.takeSeat(1, 0, {from: alice});
      await coinGame.takeSeat(1, 1, {from: bob});

      tx = await game.startGame(web3.utils.soliditySha3(key), {from: alice});
      truffleAssert.eventEmitted(tx, 'GameStarted', (e) => (
        e.account.toString() === alice &&
        (aliceGameId = e.gameId.toString()) !== "0"
      ));

      tx = await coinGame.registerGame(1, 0, aliceGameId, {from: alice});
      truffleAssert.eventEmitted(tx, 'PlayerGame', (e) => (
        e.account.toString() === alice &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === "0" &&
        e.gameId.toString() === aliceGameId
      ));

      tx = await game.startGame(web3.utils.soliditySha3(key), {from: bob});
      truffleAssert.eventEmitted(tx, 'GameStarted', (e) => (
        e.account.toString() === bob &&
        (bobGameId = e.gameId.toString()) !== "0"
      ));

      tx = await coinGame.registerGame(1, 1, bobGameId, {from: bob});
      truffleAssert.eventEmitted(tx, 'PlayerGame', (e) => (
        e.account.toString() === bob &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === "1" &&
        e.gameId.toString() === bobGameId
      ));

      for (tally=0; tally<(TALLY_COUNT-1); tally++){
        tx = await game.continueGame(
        key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, tally, {from: alice});
        truffleAssert.eventEmitted(tx, 'GameContinued', (e) => (
          e.account.toString() === alice && 
          e.turn.toString() === (tally+1).toString() && 
          e.tally.length === TALLY_COUNT && 
          parseInt(e.score.toString(), 10) === e.tally
            .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
            .reduce((total, each) => total + each)
        ));  
        await setTimeout(() => {}, 100);

        tx = await game.continueGame(
          key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, tally, {from: bob});
        truffleAssert.eventEmitted(tx, 'GameContinued', (e) => (
          e.account.toString() === bob && 
          e.turn.toString() === (tally+1).toString() && 
          e.tally.length === TALLY_COUNT && 
          parseInt(e.score.toString(), 10) === e.tally
            .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
            .reduce((total, each) => total + each)
        ));  
        await setTimeout(() => {}, 100);
      }

      let aliceScore;
      tx = await game.continueGame(
        key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, TALLY_COUNT-1, {from: alice});
      truffleAssert.eventEmitted(tx, 'GameEnded', (e) => (
          e.account.toString() === alice && 
          e.tally.length === TALLY_COUNT && 
            (aliceScore = parseInt(e.score.toString(), 10)) === e.tally
            .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
            .reduce((total, each) => total + each)
      ));

      let bobScore;
      tx = await game.continueGame(
        key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, TALLY_COUNT-1, {from: bob});
      truffleAssert.eventEmitted(tx, 'GameEnded', (e) => (
          e.account.toString() === bob && 
          e.tally.length === TALLY_COUNT && 
            (bobScore = parseInt(e.score.toString(), 10)) === e.tally
            .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
            .reduce((total, each) => total + each)
      ));

      consoleLog ('Alice Score: '+aliceScore);
      consoleLog ('Bob Score: '+bobScore);
      let reward;
      tx = await coinGame.claimGame(1, ((aliceScore >= bobScore) ? 0 : 1), 
        ((aliceScore >= bobScore) ? aliceGameId : bobGameId),
         {from: (aliceScore >= bobScore) ? alice : bob});
      truffleAssert.eventEmitted(tx, 'ScoreReward', (e) => (
        e.account.toString() === ((aliceScore >= bobScore) ? alice : bob) &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === ((aliceScore >= bobScore) ? "0" : "1") &&
        e.gameId.toString() === ((aliceScore >= bobScore) ? aliceGameId : bobGameId) &&
        e.score.toString() === ((aliceScore >= bobScore) ? aliceScore.toString() : bobScore.toString()) &&
        (reward = e.reward.toString()) === (aliceScore + bobScore).toString()
      ));

      consoleLog ('Reward: '+reward);
      expectedEndBalance -= reward;

      await coinGame.leaveSeat(1, 0, {from: alice});
      await coinGame.leaveSeat(1, 1, {from: bob});

    } catch(e) {
      await game.abortGame({from: alice});
      await game.abortGame({from: bob});
      assert(false, ''+e);
    }

  })

  it("should allow a staked VS game between alice and bob, with invalid claim", async () => {
    const key = web3.utils.soliditySha3 (Date.now());
    let tx;
    let tally;
    let aliceGameId;
    let bobGameId;
    let stakes = 1000;
    try{
      await coin.transferFrom(owner, alice, stakes.toString(), {from: owner});
      const aliceStartBalance = await coin.balanceOf(alice);
      consoleLog ('start alice balance '+aliceStartBalance);

      await coin.transferFrom(owner, bob, stakes.toString(), {from: owner});
      const bobStartBalance = await coin.balanceOf(bob);
      consoleLog ('start bob balance '+bobStartBalance);

      expectedEndBalance -= 2000;

      await coin.approve(coinGame.address, stakes.toString(), {from: alice});
      const aliceAllowance = await coin.allowance(alice, coinGame.address);  
      consoleLog ('start alice allowance '+aliceAllowance);

      await coin.approve(coinGame.address, stakes.toString(), {from: bob});
      const bobAllowance = await coin.allowance(bob, coinGame.address);  
      consoleLog ('start bob allowance '+bobAllowance);

      await coinGame.createTable (2, stakes.toString(), {from: alice});
      await coinGame.takeSeat(1, 0, {from: alice});
      await coinGame.takeSeat(1, 1, {from: bob});

      tx = await game.startGame(web3.utils.soliditySha3(key), {from: alice});
      truffleAssert.eventEmitted(tx, 'GameStarted', (e) => (
        e.account.toString() === alice &&
        (aliceGameId = e.gameId.toString()) !== "0"
      ));

      tx = await coinGame.registerGame(1, 0, aliceGameId, {from: alice});
      truffleAssert.eventEmitted(tx, 'PlayerGame', (e) => (
        e.account.toString() === alice &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === "0" &&
        e.gameId.toString() === aliceGameId
      ));

      tx = await game.startGame(web3.utils.soliditySha3(key), {from: bob});
      truffleAssert.eventEmitted(tx, 'GameStarted', (e) => (
        e.account.toString() === bob &&
        (bobGameId = e.gameId.toString()) !== "0"
      ));

      tx = await coinGame.registerGame(1, 1, bobGameId, {from: bob});
      truffleAssert.eventEmitted(tx, 'PlayerGame', (e) => (
        e.account.toString() === bob &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === "1" &&
        e.gameId.toString() === bobGameId
      ));

      for (tally=0; tally<(TALLY_COUNT-1); tally++){
        tx = await game.continueGame(
        key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, tally, {from: alice});
        truffleAssert.eventEmitted(tx, 'GameContinued', (e) => (
          e.account.toString() === alice && 
          e.turn.toString() === (tally+1).toString() && 
          e.tally.length === TALLY_COUNT && 
          parseInt(e.score.toString(), 10) === e.tally
            .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
            .reduce((total, each) => total + each)
        ));  
        await setTimeout(() => {}, 100);

        tx = await game.continueGame(
          key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, tally, {from: bob});
        truffleAssert.eventEmitted(tx, 'GameContinued', (e) => (
          e.account.toString() === bob && 
          e.turn.toString() === (tally+1).toString() && 
          e.tally.length === TALLY_COUNT && 
          parseInt(e.score.toString(), 10) === e.tally
            .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
            .reduce((total, each) => total + each)
        ));  
        await setTimeout(() => {}, 100);
      }

      let aliceScore;
      tx = await game.continueGame(
        key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, TALLY_COUNT-1, {from: alice});
      truffleAssert.eventEmitted(tx, 'GameEnded', (e) => (
          e.account.toString() === alice && 
          e.tally.length === TALLY_COUNT && 
            (aliceScore = parseInt(e.score.toString(), 10)) === e.tally
            .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
            .reduce((total, each) => total + each)
      ));

      let bobScore;
      tx = await game.continueGame(
        key, web3.utils.soliditySha3(key), BANK_ALL_FILTER, TALLY_COUNT-1, {from: bob});
      truffleAssert.eventEmitted(tx, 'GameEnded', (e) => (
          e.account.toString() === bob && 
          e.tally.length === TALLY_COUNT && 
            (bobScore = parseInt(e.score.toString(), 10)) === e.tally
            .map((value) => (parseInt(value, 10) === 255) ? 0 : parseInt(value, 10))
            .reduce((total, each) => total + each)
      ));

      consoleLog ('Alice Score: '+aliceScore);
      consoleLog ('Bob Score: '+bobScore);

      try {
        tx = await coinGame.claimGame(1, ((aliceScore < bobScore) ? 0 : 1), 
          ((aliceScore < bobScore) ? aliceGameId : bobGameId),
           {from: (aliceScore < bobScore) ? alice : bob});
        assert(false);
      } catch(e) {
        assert(true);
      }

      let scoreReward;
      tx = await coinGame.claimGame(1, ((aliceScore >= bobScore) ? 0 : 1), 
        ((aliceScore >= bobScore) ? aliceGameId : bobGameId),
         {from: (aliceScore >= bobScore) ? alice : bob});
      truffleAssert.eventEmitted(tx, 'ScoreReward', (e) => (
        e.account.toString() === ((aliceScore >= bobScore) ? alice : bob) &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === ((aliceScore >= bobScore) ? "0" : "1") &&
        e.gameId.toString() === ((aliceScore >= bobScore) ? aliceGameId : bobGameId) &&
        e.score.toString() === ((aliceScore >= bobScore) ? aliceScore.toString() : bobScore.toString()) &&
        (scoreReward = e.reward.toString()) === (aliceScore + bobScore).toString()
      ));

      consoleLog ('Score Reward: '+scoreReward);
      expectedEndBalance -= scoreReward;

      let potReward;
      truffleAssert.eventEmitted(tx, 'PotReward', (e) => (
        e.account.toString() === ((aliceScore >= bobScore) ? alice : bob) &&
        e.tableId.toString() === "1" &&
        e.seat.toString() === ((aliceScore >= bobScore) ? "0" : "1") &&
        e.gameId.toString() === ((aliceScore >= bobScore) ? aliceGameId : bobGameId) &&
        e.score.toString() === ((aliceScore >= bobScore) ? aliceScore.toString() : bobScore.toString()) &&
        (potReward = e.reward.toString()) === (stakes * 2).toString()
      ));

      consoleLog ('Pot Reward: '+potReward);

      const aliceEndBalance = await coin.balanceOf(alice);
      consoleLog ('end alice balance '+aliceEndBalance);

      const bobEndBalance = await coin.balanceOf(bob);
      consoleLog ('end bob balance '+bobEndBalance);

      await coinGame.leaveSeat(1, 0, {from: alice});
      await coinGame.leaveSeat(1, 1, {from: bob});

    } catch(e) {
      await game.abortGame({from: alice});
      await game.abortGame({from: bob});
      assert(false, ''+e);
    }

  })
});