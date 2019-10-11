pragma solidity ^0.4.24;

interface IYatzyGame {
    function gameScore(uint256 gameId) external view 
        returns (uint16 score);
    function verifyActiveGame(address account, uint256 gameId) external view 
        returns (bool verified);
}