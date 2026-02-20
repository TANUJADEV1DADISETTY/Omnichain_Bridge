// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IBridgeLock {
    function pause() external;
}

contract GovernanceEmergency is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    IBridgeLock public bridgeLock;

    event BridgePaused(address indexed by);

    constructor(address _bridgeLock) {
        bridgeLock = IBridgeLock(_bridgeLock);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function pauseBridge() external onlyRole(RELAYER_ROLE) {
        bridgeLock.pause();
        emit BridgePaused(msg.sender);
    }
}
