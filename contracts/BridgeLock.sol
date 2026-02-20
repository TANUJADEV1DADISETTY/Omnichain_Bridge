// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BridgeLock is Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    IERC20 public immutable vaultToken;
    uint256 public eventNonce;
    mapping(uint256 => bool) public processedNonces;

    event Locked(address indexed user, uint256 amount, uint256 nonce);
    event Unlocked(address indexed user, uint256 amount, uint256 nonce);

    constructor(address _vaultToken) {
        vaultToken = IERC20(_vaultToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // RELAYER_ROLE will be granted to the relayer address
        // GOVERNANCE_ROLE will be granted to the GovernanceEmergency contract
    }

    function lock(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        vaultToken.safeTransferFrom(msg.sender, address(this), amount);
        
        eventNonce++;
        emit Locked(msg.sender, amount, eventNonce);
    }

    function unlock(address user, uint256 amount, uint256 nonce) external onlyRole(RELAYER_ROLE) {
        require(!processedNonces[nonce], "Nonce already processed");
        processedNonces[nonce] = true;
        
        vaultToken.safeTransfer(user, amount);
        emit Unlocked(user, amount, nonce);
    }

    function pause() external onlyRole(GOVERNANCE_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
