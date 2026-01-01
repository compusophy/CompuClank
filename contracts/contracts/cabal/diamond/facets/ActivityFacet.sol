// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LibAppStorage, Activity, ActivityType} from "../libraries/LibAppStorage.sol";

/**
 * @title ActivityFacet
 * @notice View functions for the global activity feed
 */
contract ActivityFacet {
    /**
     * @notice Get the 10 most recent activities across all cabals
     * @return activities Array of activities (newest first)
     * @return count Number of valid activities in the array
     */
    function getRecentActivities() external view returns (Activity[10] memory activities, uint256 count) {
        return LibAppStorage.getRecentActivities();
    }

    /**
     * @notice Get total number of activities ever logged
     */
    function getTotalActivityCount() external view returns (uint256) {
        return LibAppStorage.activityBuffer().totalCount;
    }
}
