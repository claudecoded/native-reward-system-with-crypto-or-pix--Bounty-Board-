// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GitHubBountyBoard
 * @dev Secure escrow contract linking repository issues to crypto financial rewards.
 */
contract GitHubBountyBoard {
    address public immutable oracle;

    struct Bounty {
        address issuer;
        uint256 amount;
        bool isResolved;
        bool isCancelled;
    }

    // Maps string combination "repoId_issueId" to a Bounty structural data
    mapping(string => Bounty) public bounties;

    event BountyCreated(string indexed issueKey, address indexed issuer, uint256 amount);
    event BountyClaimed(string indexed issueKey, address indexed hunter, uint256 amount);
    event BountyCancelled(string indexed issueKey, address indexed issuer);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Unauthorized: Only official GitHub Oracle App can trigger this action.");
        _;
    }

    constructor(address _oracle) {
        require(_oracle != address(0), "Invalid oracle address.");
        oracle = _oracle;
    }

    /**
     * @notice Fund a new bounty for a specific GitHub issue.
     * @param _issueKey The unique string reference combining Repository ID and Issue ID (e.g., "74192_42")
     */
    function createBounty(string calldata _issueKey) external payable {
        require(msg.value > 0, "Bounty reward must be greater than zero.");
        require(bounties[_issueKey].amount == 0, "Bounty for this issue already exists.");

        bounties[_issueKey] = Bounty({
            issuer: msg.sender,
            amount: msg.value,
            isResolved: false,
            isCancelled: false
        });

        emit BountyCreated(_issueKey, msg.sender, msg.value);
    }

    /**
     * @notice Resolves and distributes the bounty reward to the contributor. Called exclusively by the trusted GitHub application.
     * @param _issueKey Unique identifier for the bounty tracking.
     * @param _hunter The cryptographical address of the developer who submitted the approved PR.
     */
    function resolveBounty(string calldata _issueKey, address payable _hunter) external onlyOracle {
        Bounty storage bounty = bounties[_issueKey];
        require(bounty.amount > 0, "Bounty target does not exist.");
        require(!bounty.isResolved, "Bounty has already been claimed.");
        require(!bounty.isCancelled, "Bounty has been previously cancelled.");
        require(_hunter != address(0), "Invalid hunter recipient address.");

        bounty.isResolved = true;
        uint256 reward = bounty.amount;
        
        (bool success, ) = _hunter.call{value: reward}("");
        require(success, "Transfer failed.");

        emit BountyClaimed(_issueKey, _hunter, reward);
    }

    /**
     * @notice Allows the original issuer to reclaim their funds if the issue is closed without resolution or abandoned.
     * @param _issueKey Unique identifier for the bounty tracking.
     */
    function cancelBounty(string calldata _issueKey) external {
        Bounty storage bounty = bounties[_issueKey];
        require(msg.sender == bounty.issuer, "Only the original bounty issuer can cancel this escrow.");
        require(!bounty.isResolved, "Cannot cancel a fully completed bounty.");
        require(!bounty.isCancelled, "Bounty is already cancelled.");

        bounty.isCancelled = true;
        uint256 refundAmount = bounty.amount;
        bounty.amount = 0;

        (bool success, ) = payable(bounty.issuer).call{value: refundAmount}("");
        require(success, "Refund transfer failed.");

        emit BountyCancelled(_issueKey, msg.sender);
    }
}
