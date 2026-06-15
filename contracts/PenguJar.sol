
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Giao diện tối giản của token USDC (ERC20) để Smart Contract tương tác
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PenguJar {
    // Khai báo token USDC dùng trong dự án
    IERC20 public immutable usdcToken;

    // Cấu trúc dữ liệu của một "Hũ tiết kiệm"
    struct Jar {
        uint256 amount;     // Số lượng USDC đang khóa
        uint256 unlockTime; // Thời mốc được mở khóa (Timestamp)
    }

    // Lưu trữ thông tin hũ của từng địa chỉ ví
    mapping(address => Jar) public jars;

    // Sự kiện dùng để log ra hệ thống khi nạp/rút tiền thành công
    event Deposited(address indexed user, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed user, uint256 amount);

    // Khởi tạo contract và gắn địa chỉ ví của token USDC vào hũ
    constructor(address _usdcAddress) {
        require(_usdcAddress != address(0), "Dia chi USDC khong hop le");
        usdcToken = IERC20(_usdcAddress);
    }

    /**
     * @dev Hàm Nạp tiền vào hũ (Deposit)
     * @param _amount Số lượng USDC muốn nạp
     * @param _lockDuration Thời gian muốn khóa (tính bằng giây, ví dụ: 60 cho 1 phút)
     */
    function deposit(uint256 _amount, uint256 _lockDuration) external {
        require(_amount > 0, "So tien nap phai lon hon 0");
        require(jars[msg.sender].amount == 0, "Ban dang co mot hu dang khoa, hay rut ra truoc khi tao hu moi");

        // Tính toán mốc thời gian mở khóa = Thời gian hiện tại + Thời gian khóa
        uint256 unlockTime = block.timestamp + _lockDuration;

        // Cập nhật dữ liệu hũ tiết kiệm của người dùng
        jars[msg.sender] = Jar({
            amount: _amount,
            unlockTime: unlockTime
        });

        // Kích hoạt hành động chuyển tiền USDC từ ví người dùng vào Smart Contract này
        // (Lưu ý: Frontend sẽ phải gọi hàm approve trên ví trước khi gọi hàm này)
        bool success = usdcToken.transferFrom(msg.sender, address(this), _amount);
        require(success, "Chuyen USDC vao hu that bai");

        emit Deposited(msg.sender, _amount, unlockTime);
    }

    /**
     * @dev Hàm Rút tiền khỏi hũ (Withdraw)
     */
    function withdraw() external {
        Jar memory userJar = jars[msg.sender];
        
        require(userJar.amount > 0, "Hu cua ban dang trong rong");
        require(block.timestamp >= userJar.unlockTime, "Chua den thoi gian mo khoa. Kim nen con nghien lai ban oi!");

        uint256 amountToWithdraw = userJar.amount;

        // Xóa dữ liệu hũ của người dùng trước khi chuyển tiền để chống lỗi reentrancy (bảo mật)
        delete jars[msg.sender];

        // Chuyển trả lại USDC từ Smart Contract về ví người dùng
        bool success = usdcToken.transfer(msg.sender, amountToWithdraw);
        require(success, "Rut USDC ve vi that bai");

        emit Withdrawn(msg.sender, amountToWithdraw);
    }

    /**
     * @dev Hàm hỗ trợ Frontend lấy thông tin nhanh của hũ
     * @return amount Số tiền đang khóa
     * @return unlockTime Mốc thời gian mở khóa
     * @return timeLeft Số giây đếm ngược còn lại (bằng 0 nếu đã đến hạn rút)
     */
    function getVaultInfo(address _user) external view returns (uint256 amount, uint256 unlockTime, uint256 timeLeft) {
        Jar memory userJar = jars[_user];
        
        if (userJar.amount == 0 || block.timestamp >= userJar.unlockTime) {
            timeLeft = 0;
        } else {
            timeLeft = userJar.unlockTime - block.timestamp;
        }
        
        return (userJar.amount, userJar.unlockTime, timeLeft);
    }
}