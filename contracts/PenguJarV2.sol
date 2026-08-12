// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PenguJarV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_NAME_LENGTH = 64;

    IERC20 public immutable USDC;
    uint256 public nextJarId = 1;

    struct Jar {
        address owner;
        uint256 balance;
        uint256 targetAmount;
        uint64 unlockTime;
        uint64 createdAt;
        bool closed;
        string name;
    }

    mapping(uint256 jarId => Jar) private _jars;
    mapping(address owner => uint256[] jarIds) private _ownerJarIds;
    mapping(uint256 jarId => mapping(address contributor => uint256 amount)) private _contributions;
    mapping(uint256 jarId => uint256 amount) private _totalContributed;

    error ZeroAddress();
    error EmptyName();
    error NameTooLong(uint256 length);
    error InvalidTargetAmount();
    error InvalidUnlockTime(uint256 unlockTime);
    error ZeroAmount();
    error JarNotFound(uint256 jarId);
    error NotJarOwner(uint256 jarId, address caller);
    error JarClosed(uint256 jarId);
    error JarMatured(uint256 jarId);
    error JarStillLocked(uint256 jarId, uint256 unlockTime);
    error EmptyJar(uint256 jarId);

    event JarCreated(
        uint256 indexed jarId,
        address indexed owner,
        string name,
        uint256 targetAmount,
        uint256 unlockTime
    );
    event JarDeposited(
        uint256 indexed jarId,
        address indexed from,
        uint256 amount,
        uint256 newBalance
    );
    event JarWithdrawn(
        uint256 indexed jarId,
        address indexed owner,
        uint256 amount
    );
    event JarContributed(
        uint256 indexed jarId,
        address indexed contributor,
        uint256 amount,
        uint256 contributorTotal,
        uint256 totalContributed,
        uint256 newBalance
    );

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        USDC = IERC20(usdcAddress);
    }

    function createJar(
        string calldata name,
        uint256 targetAmount,
        uint64 unlockTime,
        uint256 initialDeposit
    ) external nonReentrant returns (uint256 jarId) {
        uint256 nameLength = bytes(name).length;
        if (nameLength == 0) revert EmptyName();
        if (nameLength > MAX_NAME_LENGTH) revert NameTooLong(nameLength);
        if (targetAmount == 0) revert InvalidTargetAmount();
        if (unlockTime <= block.timestamp) revert InvalidUnlockTime(unlockTime);

        jarId = nextJarId++;
        _jars[jarId] = Jar({
            owner: msg.sender,
            balance: 0,
            targetAmount: targetAmount,
            unlockTime: unlockTime,
            createdAt: uint64(block.timestamp),
            closed: false,
            name: name
        });
        _ownerJarIds[msg.sender].push(jarId);

        emit JarCreated(jarId, msg.sender, name, targetAmount, unlockTime);

        if (initialDeposit > 0) {
            _deposit(jarId, msg.sender, initialDeposit);
        }
    }

    function depositToJar(uint256 jarId, uint256 amount) external nonReentrant {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.owner) revert NotJarOwner(jarId, msg.sender);
        _requireActive(jarId, jar);
        _deposit(jarId, msg.sender, amount);
    }

    function contributeToJar(uint256 jarId, uint256 amount) external nonReentrant {
        Jar storage jar = _getExistingJar(jarId);
        _requireActive(jarId, jar);
        if (amount == 0) revert ZeroAmount();

        USDC.safeTransferFrom(msg.sender, address(this), amount);

        jar.balance += amount;
        _contributions[jarId][msg.sender] += amount;
        _totalContributed[jarId] += amount;

        emit JarContributed(
            jarId,
            msg.sender,
            amount,
            _contributions[jarId][msg.sender],
            _totalContributed[jarId],
            jar.balance
        );
    }

    function withdrawJar(uint256 jarId) external nonReentrant {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.owner) revert NotJarOwner(jarId, msg.sender);
        if (jar.closed) revert JarClosed(jarId);
        if (block.timestamp < jar.unlockTime) {
            revert JarStillLocked(jarId, jar.unlockTime);
        }

        uint256 amount = jar.balance;
        if (amount == 0) revert EmptyJar(jarId);

        jar.balance = 0;
        jar.closed = true;
        USDC.safeTransfer(msg.sender, amount);

        emit JarWithdrawn(jarId, msg.sender, amount);
    }

    function getJar(uint256 jarId) external view returns (Jar memory) {
        return _getExistingJar(jarId);
    }

    function getOwnerJarIds(address owner) external view returns (uint256[] memory) {
        return _ownerJarIds[owner];
    }

    function getContribution(uint256 jarId, address contributor) external view returns (uint256) {
        _getExistingJar(jarId);
        return _contributions[jarId][contributor];
    }

    function getTotalContributed(uint256 jarId) external view returns (uint256) {
        _getExistingJar(jarId);
        return _totalContributed[jarId];
    }

    function _deposit(uint256 jarId, address from, uint256 amount) private {
        if (amount == 0) revert ZeroAmount();

        Jar storage jar = _jars[jarId];
        USDC.safeTransferFrom(from, address(this), amount);
        jar.balance += amount;

        emit JarDeposited(jarId, from, amount, jar.balance);
    }

    function _getExistingJar(uint256 jarId) private view returns (Jar storage jar) {
        jar = _jars[jarId];
        if (jar.owner == address(0)) revert JarNotFound(jarId);
    }

    function _requireActive(uint256 jarId, Jar storage jar) private view {
        if (jar.closed) revert JarClosed(jarId);
        if (block.timestamp >= jar.unlockTime) revert JarMatured(jarId);
    }
}
