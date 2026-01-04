// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ProvenanceRegistry
 * @dev Core contract for the Provence platform on Avalanche C-Chain.
 * Manages ownership timelines, document verification, and asset registration.
 */
contract ProvenanceRegistry {
    struct Record {
        uint256 id;
        string ipfsMetadata; // Pointer to off-chain details (images, rich text)
        address currentOwner;
        bytes32[] documentHashes; // Hashes of uploaded docs for verification
        address[] previousOwners; // Historical ownership chain
        uint256 timestamp; // Creation time
        bool isVerified; // Authenticity check
    }

    mapping(uint256 => Record) public records;
    mapping(uint256 => address) public recordToOwner;
    uint256 public nextId;

    event RecordCreated(uint256 indexed id, address indexed owner, string metadata);
    event OwnershipTransferred(uint256 indexed id, address indexed previousOwner, address indexed newOwner);
    event DocumentAdded(uint256 indexed id, bytes32 hash);

    // Modifiers
    modifier onlyOwner(uint256 _id) {
        require(msg.sender == recordToOwner[_id], "Caller is not the owner");
        _;
    }

    /**
     * @dev Register a new artwork or collectible.
     * @param _ipfsMetadata IPFS hash/link to the asset's metadata.
     */
    function createRecord(string memory _ipfsMetadata) public {
        Record storage newRecord = records[nextId];
        newRecord.id = nextId;
        newRecord.ipfsMetadata = _ipfsMetadata;
        newRecord.currentOwner = msg.sender;
        newRecord.timestamp = block.timestamp;
        newRecord.isVerified = false; // Default to unverified until curator signs off

        recordToOwner[nextId] = msg.sender;

        emit RecordCreated(nextId, msg.sender, _ipfsMetadata);
        nextId++;
    }

    /**
     * @dev Transfer ownership of an item. Updates the historical timeline.
     * @param _id Asset ID.
     * @param _newOwner Address of the new owner.
     */
    function transferOwnership(uint256 _id, address _newOwner) public onlyOwner(_id) {
        require(_newOwner != address(0), "Invalid new owner");
        
        Record storage record = records[_id];
        record.previousOwners.push(msg.sender);
        record.currentOwner = _newOwner;
        recordToOwner[_id] = _newOwner;

        emit OwnershipTransferred(_id, msg.sender, _newOwner);
    }

    /**
     * @dev Add a hash of a supporting document (invoice, cert of authenticity).
     * @param _id Asset ID.
     * @param _hash Keccak256 hash of the document content.
     */
    function addDocumentHash(uint256 _id, bytes32 _hash) public onlyOwner(_id) {
        records[_id].documentHashes.push(_hash);
        emit DocumentAdded(_id, _hash);
    }

    // TODO: Add verifyAuthenticity(address signer) restricted to authorized curators
}

