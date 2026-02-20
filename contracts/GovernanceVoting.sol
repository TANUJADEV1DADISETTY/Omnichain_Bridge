// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GovernanceVoting {
    IERC20 public votingToken;
    
    struct Proposal {
        uint256 id;
        bytes data;
        uint256 yesVotes;
        bool executed;
        mapping(address => bool) voted;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    event ProposalCreated(uint256 id, bytes data);
    event Voted(uint256 id, address voter, uint256 weight);
    event ProposalPassed(uint256 proposalId, bytes data);

    constructor(address _votingToken) {
        votingToken = IERC20(_votingToken);
    }

    function createProposal(bytes memory data) external {
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.id = proposalCount;
        p.data = data;
        
        emit ProposalCreated(proposalCount, data);
    }

    function vote(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Proposal already executed");
        require(!p.voted[msg.sender], "Already voted");
        
        uint256 weight = votingToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");
        
        p.voted[msg.sender] = true;
        p.yesVotes += weight;
        
        emit Voted(proposalId, msg.sender, weight);
        
        // Simple majority or threshold. Let's say 1 token is enough for this demo
        if (p.yesVotes > 0) { 
            p.executed = true;
            emit ProposalPassed(proposalId, p.data);
        }
    }
}
