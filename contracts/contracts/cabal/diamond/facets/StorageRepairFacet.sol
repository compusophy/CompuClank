// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage } from "../libraries/LibAppStorage.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

/**
 * @title StorageRepairFacet
 * @notice One-time use facet to repair corrupted storage
 * @dev Should be removed after repair is complete
 */
contract StorageRepairFacet {
    event StorageRepaired(uint256 nextCabalId);
    
    /**
     * @notice Repair the corrupted nextCabalId and allCabalIds
     * @param correctNextCabalId The correct value for nextCabalId
     */
    function repairStorage(uint256 correctNextCabalId) external {
        LibDiamond.enforceIsContractOwner();
        
        AppStorage storage s = LibAppStorage.appStorage();
        
        // Fix nextCabalId (was overwritten with hook address)
        s.nextCabalId = correctNextCabalId;
        
        // Clear allCabalIds array (was corrupted)
        // We can't easily delete a dynamic array, but we can set length to 0
        // by writing directly to the length slot
        assembly {
            // allCabalIds is at slot 7 relative to AppStorage base
            // Get the storage position
            let baseSlot := s.slot
            let arraySlot := add(baseSlot, 7)
            // Set length to 0
            sstore(arraySlot, 0)
        }
        
        emit StorageRepaired(correctNextCabalId);
    }
    
    /**
     * @notice Check current storage state
     */
    function checkStorage() external view returns (
        uint256 nextCabalId,
        uint256 allCabalIdsLength
    ) {
        AppStorage storage s = LibAppStorage.appStorage();
        return (s.nextCabalId, s.allCabalIds.length);
    }
}
