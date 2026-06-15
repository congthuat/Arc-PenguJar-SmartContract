# PenguJar - Product Specification & Build Plan

## 1. Tổng quan sản phẩm
PenguJar là một ứng dụng phi tập trung (DApp) đơn giản giúp người dùng tích lũy tài chính bằng cách khóa một lượng USDC mong muốn vào một "Hũ tiết kiệm" thông qua Smart Contract trên Arc Network. Tiền sẽ được khóa an toàn và chỉ có thể rút ra khi đạt đủ điều kiện (ví dụ: hết thời gian khóa).

## 2. Các tính năng cốt lõi (MVP)
*   **Kết nối ví:** Hỗ trợ kết nối ví Web3 tương thích với Arc Network.
*   **Nạp USDC (Deposit):** Người dùng nhập số lượng USDC và ký duyệt để gửi vào Smart Contract.
*   **Khóa thời gian (Time-lock):** Lựa chọn thời gian khóa (ví dụ: 1 phút để test nhanh, 1 ngày, 1 tuần).
*   **Rút USDC (Withdraw):** Khi hết thời gian khóa, nút Rút tiền sẽ kích hoạt để người dùng lấy lại tài sản.

## 3. Thiết kế giao diện (UI/UX) chi tiết từng vị trí
Giao diện gồm 1 màn hình duy nhất (Single Page App), giao diện tối giản (Dark Mode), căn giữa màn hình:

*   **Thanh điều hướng (Header - Cố định trên cùng):**
    *   Góc trái: Logo chữ "PenguJar 🏺" (Màu xanh neon).
    *   Góc phải: Nút [Connect Wallet] (Màu xanh dương, bo góc 8px). Khi đã kết nối, nút này đổi thành địa chỉ ví rút gọn (Ví dụ: 0x1234...abcd).
*   **Khung tương tác chính (Main Card - Nằm chính giữa màn hình):**
    *   **Khu vực hiển thị số dư (Dòng 1):** Chữ to, màu trắng: "Số dư trong hũ: X USDC". Bên dưới là dòng chữ nhỏ màu xám hiển thị thời gian mở khóa còn lại: "Mở khóa trong: MM:SS".
    *   **Ô nhập liệu (Dòng 2):** Một ô Input để nhập số lượng USDC muốn nạp. 
        *   Bên trong ô Input, sát cạnh phải có một nút chữ [MAX] nhỏ màu xám để người dùng bấm nhanh toàn bộ số dư trong ví.
    *   **Khu vực chọn thời gian (Dòng 3):** Gồm 3 nút Radio Button xếp hàng ngang: (o) 1 Phút (để test) | ( ) 1 Ngày | ( ) 1 Tuần.
    *   **Cụm nút hành động (Dòng 4):** Gồm 2 nút bấm lớn nằm cạnh nhau:
        *   Nút [ NẠP TIỀN ]: Màu xanh lá cây, bo góc, rộng 50% khung. Chỉ sáng lên khi đã nhập số > 0.
        *   Nút [ RÚT TIỀN ]: Màu xám, rộng 50% khung. Nút này sẽ bị khóa (Disabled) và chỉ đổi sang màu xanh neon (Bấm được) khi thời gian đếm ngược về 00:00.
*   **Trạng thái hệ thống (Footer):** Hiển thị một dòng chữ nhỏ dưới cùng để log trạng thái: "Trạng thái: Đang chờ kết nối ví..." hoặc "Giao dịch thành công! TxHash: ...".

## 4. Kế hoạch triển khai kỹ thuật (Ưu tiên Free Tier)
*   Smart Contract: Viết bằng Solidity, gồm 3 hàm chính: deposit(), withdraw(), và getVaultInfo(). Triển khai trên Arc Testnet.
*   Frontend: Sử dụng React (Vite) + Tailwind CSS để dựng giao diện nhanh, nhẹ.
*   Thư viện Web3: Sử dụng Ethers.js hoặc Viem để tương tác với mạng lưới Arc.

## 5. Chỉ thị cho AI Agent (Cline / Claude Code)
1. Hãy đọc bộ tài liệu qua Arc Docs MCP để nắm cấu hình RPC mạng Testnet và cách deploy contract trên Arc.
2. Build từng bước: Tạo Smart Contract trước -> Viết Test script -> Tạo Frontend -> Kết nối logic.
3. Luôn giải thích rõ ràng từng bước đang làm gì để user nắm được mạch code.
4. Ưu tiên cài đặt các gói thư viện miễn phí, nhẹ và ổn định nhất.
