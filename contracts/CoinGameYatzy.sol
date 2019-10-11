pragma solidity ^0.4.24;
import "./IYatzyGame.sol";
import "./IYatzyCoin.sol";

contract CoinGameYatzy {
    
    uint8 constant private MIN_SEATS = 1;
    uint8 constant private MAX_SEATS = 12;
    uint32 constant private MAX_ANTE = 1000000;//1 mil
    uint32 constant private MIN_BALANCE = 10000;//10k
    uint16 constant private MAX_GAME_TIME = 2700;//45 min
    uint16 constant private MAX_ENTER_TIME = 900;//15 min
    uint16 constant private MAX_IDLE_TIME = 5400;//90 min
    
    struct GameTable {
        uint8 seats;
        uint256 ante;
        uint256 started;
        mapping(uint8 => address) player;
        mapping(uint8 => uint256) game;
        mapping(uint8 => uint256) idle;
    }
    
    address private _owner;
    
    IYatzyGame private _yatzyGame;
    IYatzyCoin private _yatzyCoin;

    uint256 private _potBalance;
    uint256 private _totalScored;
    
    uint256 private _tableIndex;
    mapping(uint256 => GameTable) private _table;
    
    event TableCreated (
        address indexed account,
        uint256 indexed tableId,
        uint256 indexed ante,
        uint8 seats,
        uint256 timestamp
    );
    
    event PlayerSit (
        address indexed account,
        uint256 indexed tableId,
        uint8 indexed seat,
        uint256 timestamp
    );
    
    event PlayerLeave (
        address indexed account,
        uint256 indexed tableId,
        uint8 indexed seat,
        uint256 timestamp
    );
    
    event PlayerGame (
        address indexed account,
        uint256 indexed tableId,
        uint8 indexed seat,
        uint256 gameId,
        uint256 timestamp
    );
    
    event PotReward (
        address indexed account,
        uint256 indexed tableId,
        uint8 indexed seat,
        uint256 gameId,
        uint16 score,
        uint256 reward,
        uint256 timestamp
    );
    
    event ScoreReward (
        address indexed account,
        uint256 indexed tableId,
        uint8 indexed seat,
        uint256 gameId,
        uint16 score,
        uint256 reward,
        uint256 timestamp
    );

    event TokenFallback (
        address from, 
        uint value, 
        bytes data,
        uint256 timestamp
    );
    

    constructor(address gameAddress, address coinAddress) public { 
        _owner = msg.sender;//remove in production
        _tableIndex = 0;
        _potBalance = 0;
        _totalScored = 0;
        _yatzyGame = IYatzyGame (gameAddress);
        _yatzyCoin = IYatzyCoin (coinAddress);
    }
    
    function createTable (uint8 seats, uint256 ante) external returns(uint256 tableId) {
        require (seats >= MIN_SEATS && seats <= MAX_SEATS, "seats can be 1-12");
        require (ante <= MAX_ANTE, "Ante max 1 million");
        
        tableId = ++_tableIndex;
        _table[tableId] = GameTable (seats, ante, 0);
        
        emit TableCreated (
            msg.sender,
            tableId,
            ante,
            seats,
            now
        );
    }
    
    function takeSeat (uint256 tableId, uint8 seat) external returns(bool) {
        require (tableId != 0 && tableId <= _tableIndex && seat < _table[tableId].seats && 
            (_table[tableId].player[seat] == address(0) || //empty seat or
                (_table[tableId].game[seat] == 0 && //player not in game and
                    now > _table[tableId].idle[seat] + MAX_IDLE_TIME) //max idle time
            ), "table seat is occupied");
            
        _table[tableId].player[seat] = msg.sender;
        _table[tableId].idle[seat] = now;
        
        emit PlayerSit (
            msg.sender,
            tableId,
            seat,
            now
        );
        
        return true;
    }

    function soloSeat () external returns(uint256 tableId) {

        tableId = ++_tableIndex;
        _table[tableId] = GameTable (1, 0, 0);
        _table[tableId].player[0] = msg.sender;
        _table[tableId].idle[0] = now;
        
        emit TableCreated (
            msg.sender,
            tableId,
            0,
            1,
            now
        );

        emit PlayerSit (
            msg.sender,
            tableId,
            0,
            now
        );
    }
    
    function leaveSeat (uint256 tableId, uint8 seat) external returns(bool) {
        require (tableId != 0 && tableId <= _tableIndex && seat < _table[tableId].seats &&
            _table[tableId].player[seat] == msg.sender, "not seated there");
        require (_table[tableId].game[seat] == 0, "game in progress");
            
        _table[tableId].player[seat] = address(0);
       
        emit PlayerLeave (
            msg.sender,
            tableId,
            seat,
            now
        );
        
        return true;
    }
    
    function registerGame (uint256 tableId, uint8 seat, uint256 gameId) external 
        returns(bool) {
        require (tableId != 0 && tableId <= _tableIndex && seat < _table[tableId].seats &&
            _table[tableId].player[seat] == msg.sender, "not seated there");
        //require (_table[tableId].status == 0, "game in progress");
        require (_table[tableId].game[seat] == 0, "game already registered");
        require (_yatzyGame.verifyActiveGame(msg.sender, gameId), "game not active");
        if (_table[tableId].started > 0)
            require (now < _table[tableId].started + MAX_ENTER_TIME, "Too late to enter");
        
        if (_table[tableId].ante > 0) {
            require (_yatzyCoin.allowance(msg.sender, address(this)) >= _table[tableId].ante, 
                "Ante required");
            _yatzyCoin.transferFrom(msg.sender, address(this), _table[tableId].ante);
            _potBalance += _table[tableId].ante;
        }

        _table[tableId].game[seat] = gameId;
        _table[tableId].idle[seat] = now;
        if (_table[tableId].started == 0) _table[tableId].started = now;
        
        emit PlayerGame (
            msg.sender,
            tableId,
            seat,
            gameId,
            now
        );
        
        return true;
    }
    
    function claimGame (uint256 tableId, uint8 seat, uint256 gameId) external 
        returns(bool validClaim) {
        require (tableId != 0 && tableId <= _tableIndex && seat < _table[tableId].seats &&
            _table[tableId].player[seat] == msg.sender, "not seated there");
        
        require (_table[tableId].started != 0 && 
            _table[tableId].game[seat] == gameId, "Not in a game");
        bool timeIsUp = (now > _table[tableId].started + MAX_GAME_TIME);
        require (timeIsUp || !_yatzyGame.verifyActiveGame(msg.sender, gameId), 
            "Game still active");
        
         _table[tableId].game[seat] = 0;
         
        uint16 score = _yatzyGame.gameScore(gameId);
        validClaim = true;
        uint8 seat_ = 0;
        uint16 totalScore = score;
        uint8 anteMult = (_table[tableId].ante == 0) ? 0 : 1;
        while (validClaim && seat_ < _table[tableId].seats) {
            if (seat_ != seat && _table[tableId].player[seat_] != address(0) && 
                _table[tableId].game[seat_] != 0) {
                    
                validClaim = (timeIsUp || !_yatzyGame.verifyActiveGame(
                    _table[tableId].player[seat_], _table[tableId].game[seat_]));
                if (validClaim) {
                    uint16 score_ = _yatzyGame.gameScore(_table[tableId].game[seat_]);
                    validClaim = (score >= score_);//first claim gets the tie
                    if (validClaim) {
                        totalScore += score_;
                        if (_table[tableId].ante > 0) anteMult += 1;
                        _table[tableId].game[seat_] = 0;
                    }
                }
            }
            seat_++;
        }
        require (validClaim, "Invalid claim");

        //If table has ante, pay out pot
        if (_table[tableId].ante > 0 && anteMult > 0) {
            uint256 potAmount =  _table[tableId].ante * anteMult;
            require (_yatzyCoin.balanceOf(address(this)) >= potAmount, "Insufficient funds");
            _potBalance -= potAmount;
            _yatzyCoin.transferFrom(address(this), msg.sender, potAmount);
            emit PotReward (
                msg.sender,
                tableId,
                seat,
                gameId,
                score,
                potAmount,
                now
            );
        }

        //If contract has available funds, give total score to winner.
        if (totalScore > 0 && 
            _yatzyCoin.balanceOf(address(this)) >= (totalScore + _potBalance + MIN_BALANCE)) {
            _yatzyCoin.transferFrom(address(this), msg.sender, totalScore);
            _totalScored += totalScore;
        } else totalScore = 0;

        _table[tableId].started = 0;

        emit ScoreReward (
            msg.sender,
            tableId,
            seat,
            gameId,
            score,
            totalScore,
            now
        );
    }

    function tokenFallback(address from, uint value, bytes memory data) public {
        emit TokenFallback (
            from,
            value,
            data,
            now
        );
    }

    //remove in production
    function destroy() external {
       require (msg.sender == _owner);
       uint256 balance = _yatzyCoin.balanceOf(address(this));
       _yatzyCoin.transferFrom(address(this), _owner, balance);
       selfdestruct(_owner);
    }
    
    //Return to sender, any abstract transfers
    function () external payable { msg.sender.transfer(msg.value); }

}