// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct ExactInputSingleParams {
    PoolKey poolKey;
    bool zeroForOne;
    uint128 amountIn;
    uint128 amountOutMinimum;
    bytes hookData;
}

contract EncodeTest {
    address constant UNIVERSAL_ROUTER = 0x4F63E5e685126e7f307f0Ae108F6Bd374f061219;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    uint8 constant COMMAND_V4_SWAP = 0x10;
    uint8 constant COMMAND_SWEEP = 0x04;
    uint8 constant COMMAND_WRAP_ETH = 0x0b;
    
    uint8 constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 constant SETTLE_ALL = 0x0C;
    uint8 constant TAKE_ALL = 0x0F;
    
    function getEncoding(
        address token,
        address hook,
        uint128 amountIn,
        uint128 minAmountOut
    ) external view returns (
        bytes memory commands,
        bytes memory input0,
        bytes memory input1,
        bytes memory input2
    ) {
        bool zeroForOne = WETH < token;
        
        PoolKey memory poolKey = PoolKey({
            currency0: zeroForOne ? WETH : token,
            currency1: zeroForOne ? token : WETH,
            fee: 8388608,
            tickSpacing: 200,
            hooks: hook
        });

        bytes memory actions = abi.encodePacked(
            SWAP_EXACT_IN_SINGLE,
            SETTLE_ALL,
            TAKE_ALL
        );

        bytes[] memory params = new bytes[](3);
        
        params[0] = abi.encode(
            ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: zeroForOne,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                hookData: bytes("")
            })
        );
        
        params[1] = abi.encode(
            zeroForOne ? poolKey.currency0 : poolKey.currency1,
            amountIn
        );
        
        params[2] = abi.encode(
            zeroForOne ? poolKey.currency1 : poolKey.currency0,
            minAmountOut
        );

        bytes[] memory inputs = new bytes[](3);
        
        inputs[0] = abi.encode(UNIVERSAL_ROUTER, uint256(amountIn));
        inputs[1] = abi.encode(actions, params);
        inputs[2] = abi.encode(token, address(this), uint256(0));

        commands = abi.encodePacked(COMMAND_WRAP_ETH, COMMAND_V4_SWAP, COMMAND_SWEEP);
        input0 = inputs[0];
        input1 = inputs[1];
        input2 = inputs[2];
    }
}
