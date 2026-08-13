// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PenguJarV3 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MIN_WITHDRAWAL_DELAY = 1 hours;
    uint256 public constant MAX_WITHDRAWAL_DELAY = 30 days;
    uint256 public constant GUARDIAN_FREEZE_RECOVERY_DELAY = 7 days;
    uint256 public constant GUARDIAN_CHANGE_DELAY = 7 days;
    uint256 public constant OWNER_RECOVERY_DELAY = 7 days;

    enum JarMode {
        SAFE,
        SHIELDED
    }

    enum PrivacyMode {
        PUBLIC,
        PRIVATE
    }

    IERC20 public immutable USDC;
    uint256 public nextJarId = 1;

    struct Jar {
        address owner;
        uint256 balance;
        uint256 targetAmount;
        uint64 unlockTime;
        uint64 createdAt;
        bool closed;
        JarMode mode;
        PrivacyMode privacyMode;
        uint256 withdrawalDelay;
        uint256 withdrawalReadyAt;
        bytes32 metadataCommitment;
        address guardian;
        bool frozen;
        uint256 freezeRecoveryReadyAt;
        address pendingGuardian;
        uint256 guardianChangeReadyAt;
        address recoveryWallet;
        bool guardianChangeRecoveryApproved;
        address pendingOwner;
        uint256 ownerRecoveryReadyAt;
        bool guardianApprovedOwnerRecovery;
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
    error InvalidMetadataCommitment();
    error InvalidWithdrawalDelay(
        uint256 withdrawalDelay,
        uint256 minimumDelay,
        uint256 maximumDelay
    );
    error InvalidJarMode(uint256 jarId, JarMode expectedMode);
    error WithdrawalRequestMissing(uint256 jarId);
    error WithdrawalRequestAlreadyActive(uint256 jarId);
    error SecurityDelayActive(uint256 jarId, uint256 readyAt);
    error InvalidGuardian(address guardian);
    error GuardianNotConfigured(uint256 jarId);
    error NotJarGuardian(uint256 jarId, address caller);
    error JarFrozen(uint256 jarId);
    error JarNotFrozen(uint256 jarId);
    error FreezeRecoveryActive(uint256 jarId, uint256 readyAt);
    error GuardianChangeAlreadyPending(uint256 jarId);
    error GuardianChangeMissing(uint256 jarId);
    error GuardianChangeDelayActive(uint256 jarId, uint256 readyAt);
    error GuardianUnchanged(uint256 jarId, address guardian);
    error InvalidRecoveryWallet(address recoveryWallet);
    error NotRecoveryWallet(uint256 jarId, address caller);
    error GuardianChangeNotApproved(uint256 jarId);
    error OwnerRecoveryAlreadyPending(uint256 jarId);
    error OwnerRecoveryMissing(uint256 jarId);
    error InvalidRecoveredOwner(address newOwner);
    error OwnerRecoveryNotApproved(uint256 jarId);
    error OwnerRecoveryDelayActive(uint256 jarId, uint256 readyAt);
    error NotPendingOwner(uint256 jarId, address caller);

    event JarCreated(
        uint256 indexed jarId,
        address indexed owner,
        string name,
        uint256 targetAmount,
        uint256 unlockTime
    );
    event JarSecurityConfigured(
        uint256 indexed jarId,
        JarMode mode,
        uint256 withdrawalDelay
    );
    event JarPrivacyConfigured(
        uint256 indexed jarId,
        PrivacyMode privacyMode,
        bytes32 metadataCommitment
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
    event WithdrawalRequested(
        uint256 indexed jarId,
        address indexed owner,
        uint256 requestedAt,
        uint256 readyAt
    );
    event WithdrawalRequestCancelled(
        uint256 indexed jarId,
        address indexed owner
    );
    event WithdrawalFrozen(
        uint256 indexed jarId,
        address indexed guardian,
        uint256 recoveryReadyAt
    );
    event JarUnfrozen(uint256 indexed jarId, address indexed owner);
    event GuardianChangeRequested(
        uint256 indexed jarId,
        address indexed currentGuardian,
        address indexed newGuardian,
        uint256 readyAt
    );
    event GuardianChangeCancelled(
        uint256 indexed jarId,
        address indexed guardian
    );
    event GuardianChanged(
        uint256 indexed jarId,
        address indexed oldGuardian,
        address indexed newGuardian
    );
    event GuardianChangeApproved(
        uint256 indexed jarId,
        address indexed recoveryWallet
    );
    event OwnerRecoveryRequested(
        uint256 indexed jarId,
        address indexed recoveryWallet,
        address indexed newOwner,
        uint256 readyAt
    );
    event OwnerRecoveryApproved(
        uint256 indexed jarId,
        address indexed guardian
    );
    event OwnerRecovered(
        uint256 indexed jarId,
        address indexed oldOwner,
        address indexed newOwner
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
        jarId = _createJar(
            name,
            targetAmount,
            unlockTime,
            initialDeposit,
            JarMode.SAFE,
            0,
            PrivacyMode.PUBLIC,
            bytes32(0),
            address(0),
            address(0)
        );
    }

    function createShieldedJar(
        string calldata name,
        uint256 targetAmount,
        uint64 unlockTime,
        uint256 initialDeposit,
        uint256 withdrawalDelay
    ) external nonReentrant returns (uint256 jarId) {
        if (
            withdrawalDelay < MIN_WITHDRAWAL_DELAY ||
            withdrawalDelay > MAX_WITHDRAWAL_DELAY
        ) {
            revert InvalidWithdrawalDelay(
                withdrawalDelay,
                MIN_WITHDRAWAL_DELAY,
                MAX_WITHDRAWAL_DELAY
            );
        }

        jarId = _createJar(
            name,
            targetAmount,
            unlockTime,
            initialDeposit,
            JarMode.SHIELDED,
            withdrawalDelay,
            PrivacyMode.PUBLIC,
            bytes32(0),
            address(0),
            address(0)
        );
    }

    function createGuardianShieldedJar(
        string calldata name,
        uint256 targetAmount,
        uint64 unlockTime,
        uint256 initialDeposit,
        uint256 withdrawalDelay,
        address guardian,
        address recoveryWallet
    ) external nonReentrant returns (uint256 jarId) {
        _validateWithdrawalDelay(withdrawalDelay);
        _validateGuardian(guardian);
        _validateRecoveryWallet(recoveryWallet, guardian);

        jarId = _createJar(
            name,
            targetAmount,
            unlockTime,
            initialDeposit,
            JarMode.SHIELDED,
            withdrawalDelay,
            PrivacyMode.PUBLIC,
            bytes32(0),
            guardian,
            recoveryWallet
        );
    }

    function createPrivateJar(
        bytes32 metadataCommitment,
        uint64 unlockTime,
        uint256 initialDeposit
    ) external nonReentrant returns (uint256 jarId) {
        if (metadataCommitment == bytes32(0)) {
            revert InvalidMetadataCommitment();
        }

        jarId = _createJar(
            "",
            0,
            unlockTime,
            initialDeposit,
            JarMode.SAFE,
            0,
            PrivacyMode.PRIVATE,
            metadataCommitment,
            address(0),
            address(0)
        );
    }

    function createPrivateShieldedJar(
        bytes32 metadataCommitment,
        uint64 unlockTime,
        uint256 initialDeposit,
        uint256 withdrawalDelay
    ) external nonReentrant returns (uint256 jarId) {
        if (metadataCommitment == bytes32(0)) {
            revert InvalidMetadataCommitment();
        }
        if (
            withdrawalDelay < MIN_WITHDRAWAL_DELAY ||
            withdrawalDelay > MAX_WITHDRAWAL_DELAY
        ) {
            revert InvalidWithdrawalDelay(
                withdrawalDelay,
                MIN_WITHDRAWAL_DELAY,
                MAX_WITHDRAWAL_DELAY
            );
        }

        jarId = _createJar(
            "",
            0,
            unlockTime,
            initialDeposit,
            JarMode.SHIELDED,
            withdrawalDelay,
            PrivacyMode.PRIVATE,
            metadataCommitment,
            address(0),
            address(0)
        );
    }

    function createPrivateGuardianShieldedJar(
        bytes32 metadataCommitment,
        uint64 unlockTime,
        uint256 initialDeposit,
        uint256 withdrawalDelay,
        address guardian,
        address recoveryWallet
    ) external nonReentrant returns (uint256 jarId) {
        if (metadataCommitment == bytes32(0)) {
            revert InvalidMetadataCommitment();
        }
        _validateWithdrawalDelay(withdrawalDelay);
        _validateGuardian(guardian);
        _validateRecoveryWallet(recoveryWallet, guardian);

        jarId = _createJar(
            "",
            0,
            unlockTime,
            initialDeposit,
            JarMode.SHIELDED,
            withdrawalDelay,
            PrivacyMode.PRIVATE,
            metadataCommitment,
            guardian,
            recoveryWallet
        );
    }

    function _createJar(
        string memory name,
        uint256 targetAmount,
        uint64 unlockTime,
        uint256 initialDeposit,
        JarMode mode,
        uint256 withdrawalDelay,
        PrivacyMode privacyMode,
        bytes32 metadataCommitment,
        address guardian,
        address recoveryWallet
    ) private returns (uint256 jarId) {
        if (privacyMode == PrivacyMode.PUBLIC) {
            uint256 nameLength = bytes(name).length;
            if (nameLength == 0) revert EmptyName();
            if (nameLength > MAX_NAME_LENGTH) revert NameTooLong(nameLength);
            if (targetAmount == 0) revert InvalidTargetAmount();
        }
        if (unlockTime <= block.timestamp) revert InvalidUnlockTime(unlockTime);

        jarId = nextJarId++;
        _jars[jarId] = Jar({
            owner: msg.sender,
            balance: 0,
            targetAmount: targetAmount,
            unlockTime: unlockTime,
            createdAt: uint64(block.timestamp),
            closed: false,
            mode: mode,
            privacyMode: privacyMode,
            withdrawalDelay: withdrawalDelay,
            withdrawalReadyAt: 0,
            metadataCommitment: metadataCommitment,
            guardian: guardian,
            frozen: false,
            freezeRecoveryReadyAt: 0,
            pendingGuardian: address(0),
            guardianChangeReadyAt: 0,
            recoveryWallet: recoveryWallet,
            guardianChangeRecoveryApproved: false,
            pendingOwner: address(0),
            ownerRecoveryReadyAt: 0,
            guardianApprovedOwnerRecovery: false,
            name: name
        });
        _ownerJarIds[msg.sender].push(jarId);

        emit JarCreated(jarId, msg.sender, name, targetAmount, unlockTime);
        emit JarSecurityConfigured(jarId, mode, withdrawalDelay);
        emit JarPrivacyConfigured(jarId, privacyMode, metadataCommitment);

        if (initialDeposit > 0) {
            _deposit(jarId, msg.sender, initialDeposit);
        }
    }

    function requestWithdrawal(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.owner) revert NotJarOwner(jarId, msg.sender);
        if (jar.closed) revert JarClosed(jarId);
        if (jar.mode != JarMode.SHIELDED) {
            revert InvalidJarMode(jarId, JarMode.SHIELDED);
        }
        if (jar.frozen) revert JarFrozen(jarId);
        if (block.timestamp < jar.unlockTime) {
            revert JarStillLocked(jarId, jar.unlockTime);
        }
        if (jar.withdrawalReadyAt != 0) {
            revert WithdrawalRequestAlreadyActive(jarId);
        }

        uint256 readyAt = block.timestamp + jar.withdrawalDelay;
        jar.withdrawalReadyAt = readyAt;

        emit WithdrawalRequested(jarId, msg.sender, block.timestamp, readyAt);
    }

    function freezeWithdrawal(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.guardian) revert NotJarGuardian(jarId, msg.sender);
        if (jar.closed) revert JarClosed(jarId);
        if (jar.mode != JarMode.SHIELDED) {
            revert InvalidJarMode(jarId, JarMode.SHIELDED);
        }
        if (jar.guardian == address(0)) revert GuardianNotConfigured(jarId);
        if (jar.frozen) revert JarFrozen(jarId);
        if (jar.withdrawalReadyAt == 0) {
            revert WithdrawalRequestMissing(jarId);
        }

        uint256 recoveryReadyAt = block.timestamp + GUARDIAN_FREEZE_RECOVERY_DELAY;
        jar.frozen = true;
        jar.withdrawalReadyAt = 0;
        jar.freezeRecoveryReadyAt = recoveryReadyAt;
        jar.pendingGuardian = address(0);
        jar.guardianChangeReadyAt = 0;
        jar.guardianChangeRecoveryApproved = false;

        emit WithdrawalFrozen(jarId, msg.sender, recoveryReadyAt);
    }

    function unfreezeJar(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.owner) revert NotJarOwner(jarId, msg.sender);
        if (jar.closed) revert JarClosed(jarId);
        if (!jar.frozen) revert JarNotFrozen(jarId);
        if (jar.pendingOwner != address(0)) {
            revert OwnerRecoveryAlreadyPending(jarId);
        }
        if (block.timestamp < jar.freezeRecoveryReadyAt) {
            revert FreezeRecoveryActive(jarId, jar.freezeRecoveryReadyAt);
        }

        jar.frozen = false;
        jar.freezeRecoveryReadyAt = 0;

        emit JarUnfrozen(jarId, msg.sender);
    }

    function requestGuardianChange(uint256 jarId, address newGuardian) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.owner) revert NotJarOwner(jarId, msg.sender);
        _requireGuardianJar(jarId, jar);
        if (jar.frozen) revert JarFrozen(jarId);
        if (
            newGuardian == address(0) ||
            newGuardian == jar.owner ||
            newGuardian == jar.recoveryWallet
        ) {
            revert InvalidGuardian(newGuardian);
        }
        if (newGuardian == jar.guardian) {
            revert GuardianUnchanged(jarId, newGuardian);
        }
        if (jar.pendingGuardian != address(0)) {
            revert GuardianChangeAlreadyPending(jarId);
        }

        uint256 readyAt = block.timestamp + GUARDIAN_CHANGE_DELAY;
        jar.pendingGuardian = newGuardian;
        jar.guardianChangeReadyAt = readyAt;
        jar.guardianChangeRecoveryApproved = false;

        emit GuardianChangeRequested(jarId, jar.guardian, newGuardian, readyAt);
    }

    function approveGuardianChange(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.recoveryWallet) {
            revert NotRecoveryWallet(jarId, msg.sender);
        }
        _requireGuardianJar(jarId, jar);
        if (jar.frozen) revert JarFrozen(jarId);
        if (jar.pendingGuardian == address(0)) revert GuardianChangeMissing(jarId);

        jar.guardianChangeRecoveryApproved = true;

        emit GuardianChangeApproved(jarId, msg.sender);
    }

    function cancelGuardianChange(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.owner) revert NotJarOwner(jarId, msg.sender);
        _requireGuardianJar(jarId, jar);
        if (jar.frozen) revert JarFrozen(jarId);
        address pendingGuardian = jar.pendingGuardian;
        if (pendingGuardian == address(0)) revert GuardianChangeMissing(jarId);

        jar.pendingGuardian = address(0);
        jar.guardianChangeReadyAt = 0;
        jar.guardianChangeRecoveryApproved = false;

        emit GuardianChangeCancelled(jarId, pendingGuardian);
    }

    function executeGuardianChange(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.owner) revert NotJarOwner(jarId, msg.sender);
        _requireGuardianJar(jarId, jar);
        if (jar.frozen) revert JarFrozen(jarId);
        address newGuardian = jar.pendingGuardian;
        if (newGuardian == address(0)) revert GuardianChangeMissing(jarId);
        if (jar.withdrawalReadyAt != 0) {
            revert WithdrawalRequestAlreadyActive(jarId);
        }
        if (!jar.guardianChangeRecoveryApproved) {
            revert GuardianChangeNotApproved(jarId);
        }
        if (block.timestamp < jar.guardianChangeReadyAt) {
            revert GuardianChangeDelayActive(jarId, jar.guardianChangeReadyAt);
        }

        address oldGuardian = jar.guardian;
        jar.guardian = newGuardian;
        jar.pendingGuardian = address(0);
        jar.guardianChangeReadyAt = 0;
        jar.guardianChangeRecoveryApproved = false;

        emit GuardianChanged(jarId, oldGuardian, newGuardian);
    }

    function requestOwnerRecovery(uint256 jarId, address newOwner) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.recoveryWallet) {
            revert NotRecoveryWallet(jarId, msg.sender);
        }
        if (jar.closed) revert JarClosed(jarId);
        if (!jar.frozen) revert JarNotFrozen(jarId);
        if (
            newOwner == address(0) ||
            newOwner == jar.owner ||
            newOwner == jar.guardian ||
            newOwner == jar.recoveryWallet
        ) {
            revert InvalidRecoveredOwner(newOwner);
        }
        if (jar.pendingOwner != address(0)) {
            revert OwnerRecoveryAlreadyPending(jarId);
        }

        uint256 readyAt = block.timestamp + OWNER_RECOVERY_DELAY;
        jar.pendingOwner = newOwner;
        jar.ownerRecoveryReadyAt = readyAt;
        jar.guardianApprovedOwnerRecovery = false;

        emit OwnerRecoveryRequested(jarId, msg.sender, newOwner, readyAt);
    }

    function approveOwnerRecovery(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.guardian) revert NotJarGuardian(jarId, msg.sender);
        if (jar.closed) revert JarClosed(jarId);
        if (!jar.frozen) revert JarNotFrozen(jarId);
        if (jar.pendingOwner == address(0)) revert OwnerRecoveryMissing(jarId);

        jar.guardianApprovedOwnerRecovery = true;

        emit OwnerRecoveryApproved(jarId, msg.sender);
    }

    function executeOwnerRecovery(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        address newOwner = jar.pendingOwner;
        if (msg.sender != newOwner) revert NotPendingOwner(jarId, msg.sender);
        if (jar.closed) revert JarClosed(jarId);
        if (!jar.frozen) revert JarNotFrozen(jarId);
        if (newOwner == address(0)) revert OwnerRecoveryMissing(jarId);
        if (!jar.guardianApprovedOwnerRecovery) {
            revert OwnerRecoveryNotApproved(jarId);
        }
        if (block.timestamp < jar.ownerRecoveryReadyAt) {
            revert OwnerRecoveryDelayActive(jarId, jar.ownerRecoveryReadyAt);
        }

        address oldOwner = jar.owner;
        jar.owner = newOwner;
        jar.pendingOwner = address(0);
        jar.ownerRecoveryReadyAt = 0;
        jar.guardianApprovedOwnerRecovery = false;
        jar.withdrawalReadyAt = 0;
        jar.pendingGuardian = address(0);
        jar.guardianChangeReadyAt = 0;
        jar.guardianChangeRecoveryApproved = false;
        jar.freezeRecoveryReadyAt = 0;
        jar.frozen = false;
        _ownerJarIds[newOwner].push(jarId);

        emit OwnerRecovered(jarId, oldOwner, newOwner);
    }

    function cancelWithdrawalRequest(uint256 jarId) external {
        Jar storage jar = _getExistingJar(jarId);
        if (msg.sender != jar.owner) revert NotJarOwner(jarId, msg.sender);
        if (jar.closed) revert JarClosed(jarId);
        if (jar.mode != JarMode.SHIELDED) {
            revert InvalidJarMode(jarId, JarMode.SHIELDED);
        }
        if (jar.withdrawalReadyAt == 0) {
            revert WithdrawalRequestMissing(jarId);
        }

        jar.withdrawalReadyAt = 0;

        emit WithdrawalRequestCancelled(jarId, msg.sender);
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
        if (jar.frozen) revert JarFrozen(jarId);
        if (block.timestamp < jar.unlockTime) {
            revert JarStillLocked(jarId, jar.unlockTime);
        }
        if (jar.mode == JarMode.SHIELDED) {
            uint256 readyAt = jar.withdrawalReadyAt;
            if (readyAt == 0) revert WithdrawalRequestMissing(jarId);
            if (block.timestamp < readyAt) {
                revert SecurityDelayActive(jarId, readyAt);
            }
        }

        uint256 amount = jar.balance;
        if (amount == 0) revert EmptyJar(jarId);

        jar.balance = 0;
        jar.closed = true;
        jar.withdrawalReadyAt = 0;
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

    function _validateWithdrawalDelay(uint256 withdrawalDelay) private pure {
        if (
            withdrawalDelay < MIN_WITHDRAWAL_DELAY ||
            withdrawalDelay > MAX_WITHDRAWAL_DELAY
        ) {
            revert InvalidWithdrawalDelay(
                withdrawalDelay,
                MIN_WITHDRAWAL_DELAY,
                MAX_WITHDRAWAL_DELAY
            );
        }
    }

    function _validateGuardian(address guardian) private view {
        if (guardian == address(0) || guardian == msg.sender) {
            revert InvalidGuardian(guardian);
        }
    }

    function _validateRecoveryWallet(
        address recoveryWallet,
        address guardian
    ) private view {
        if (
            recoveryWallet == address(0) ||
            recoveryWallet == msg.sender ||
            recoveryWallet == guardian
        ) {
            revert InvalidRecoveryWallet(recoveryWallet);
        }
    }

    function _requireGuardianJar(uint256 jarId, Jar storage jar) private view {
        if (jar.closed) revert JarClosed(jarId);
        if (jar.mode != JarMode.SHIELDED) {
            revert InvalidJarMode(jarId, JarMode.SHIELDED);
        }
        if (jar.guardian == address(0)) revert GuardianNotConfigured(jarId);
    }
}
