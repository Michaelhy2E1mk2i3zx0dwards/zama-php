// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract SecureVotingFHE is SepoliaConfig {

    struct EncryptedVote {
        uint256 id;
        euint32 encryptedCandidate;
        euint32 encryptedWeight;
        uint256 timestamp;
    }

    struct DecryptedVote {
        string candidate;
        uint32 weight;
        bool counted;
    }

    uint256 public voteCount;
    mapping(uint256 => EncryptedVote) public encryptedVotes;
    mapping(uint256 => DecryptedVote) public decryptedVotes;

    mapping(string => euint32) private encryptedCandidateCount;
    string[] private candidateList;

    mapping(uint256 => uint256) private requestToVoteId;

    event VoteSubmitted(uint256 indexed id, uint256 timestamp);
    event VoteDecryptionRequested(uint256 indexed id);
    event VoteDecrypted(uint256 indexed id);

    modifier onlyVoter(uint256 voteId) {
        _;
    }

    /// @notice Submit a new encrypted vote
    function submitEncryptedVote(
        euint32 encryptedCandidate,
        euint32 encryptedWeight
    ) public {
        voteCount += 1;
        uint256 newId = voteCount;

        encryptedVotes[newId] = EncryptedVote({
            id: newId,
            encryptedCandidate: encryptedCandidate,
            encryptedWeight: encryptedWeight,
            timestamp: block.timestamp
        });

        decryptedVotes[newId] = DecryptedVote({
            candidate: "",
            weight: 0,
            counted: false
        });

        emit VoteSubmitted(newId, block.timestamp);
    }

    /// @notice Request decryption of a vote
    function requestVoteDecryption(uint256 voteId) public onlyVoter(voteId) {
        EncryptedVote storage vote = encryptedVotes[voteId];
        require(!decryptedVotes[voteId].counted, "Already decrypted");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(vote.encryptedCandidate);
        ciphertexts[1] = FHE.toBytes32(vote.encryptedWeight);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptVote.selector);
        requestToVoteId[reqId] = voteId;

        emit VoteDecryptionRequested(voteId);
    }

    /// @notice Callback for decrypted vote
    function decryptVote(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 voteId = requestToVoteId[requestId];
        require(voteId != 0, "Invalid request");

        EncryptedVote storage eVote = encryptedVotes[voteId];
        DecryptedVote storage dVote = decryptedVotes[voteId];
        require(!dVote.counted, "Already decrypted");

        FHE.checkSignatures(requestId, cleartexts, proof);

        string[] memory results = abi.decode(cleartexts, (string[]));
        dVote.candidate = results[0];
        dVote.weight = abi.decode(abi.encodePacked(results[1]), (uint32));
        dVote.counted = true;

        if (!FHE.isInitialized(encryptedCandidateCount[dVote.candidate])) {
            encryptedCandidateCount[dVote.candidate] = FHE.asEuint32(0);
            candidateList.push(dVote.candidate);
        }

        encryptedCandidateCount[dVote.candidate] = FHE.add(
            encryptedCandidateCount[dVote.candidate],
            FHE.asEuint32(1)
        );

        emit VoteDecrypted(voteId);
    }

    /// @notice Get decrypted vote details
    function getDecryptedVote(uint256 voteId) public view returns (
        string memory candidate,
        uint32 weight,
        bool counted
    ) {
        DecryptedVote storage v = decryptedVotes[voteId];
        return (v.candidate, v.weight, v.counted);
    }

    /// @notice Get encrypted candidate count
    function getEncryptedCandidateCount(string memory candidate) public view returns (euint32) {
        return encryptedCandidateCount[candidate];
    }

    /// @notice Request decryption of candidate count
    function requestCandidateCountDecryption(string memory candidate) public {
        euint32 count = encryptedCandidateCount[candidate];
        require(FHE.isInitialized(count), "Candidate not found");

        bytes32 ;
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptCandidateCount.selector);
        requestToVoteId[reqId] = bytes32ToUint(keccak256(abi.encodePacked(candidate)));
    }

    /// @notice Callback for decrypted candidate count
    function decryptCandidateCount(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 candidateHash = requestToVoteId[requestId];
        string memory candidate = getCandidateFromHash(candidateHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));
    }

    function bytes32ToUint(bytes32 b) private pure returns (uint256) {
        return uint256(b);
    }

    function getCandidateFromHash(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < candidateList.length; i++) {
            if (bytes32ToUint(keccak256(abi.encodePacked(candidateList[i]))) == hash) {
                return candidateList[i];
            }
        }
        revert("Candidate not found");
    }
}
