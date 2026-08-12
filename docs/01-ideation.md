# 01 — Ideation Case Study

## Câu 0 — PenguJar có đúng hướng Arc không?
**Pass.** Hướng chính là **peer-to-peer payments + programmable stablecoin savings**.

PenguJar không cần giả vờ là DEX hay AI app. Lý do dùng Arc phải xuất hiện ngay trong luồng tiền:
- USDC là tài sản trung tâm của app.
- Người dùng góp USDC trực tiếp vào hũ.
- Shared Jar biến việc tiết kiệm thành một P2P contribution flow.
- Time-lock biến một thói quen tài chính thành rule onchain.

## Câu 1 — Đây có phải hành vi thật của người dùng Việt Nam không?
**Pass.** “Bỏ heo”, góp tiền chung, để dành cho chuyến đi, quà, học phí hoặc một món đồ là hành vi đời thực rất dễ hiểu.

### Người dùng chính
Người dùng phổ thông đã có ví EVM và muốn dành riêng một khoản USDC cho một mục tiêu cụ thể.

### Người dùng phụ
Bạn bè/người thân chỉ muốn góp vào một hũ đã được chia sẻ mà không có quyền rút.

### Yêu cầu quan trọng nhất
**Tin được.** Khi app nói “khóa tới ngày X”, smart contract phải thực thi điều đó. UI không được tạo cảm giác khóa giả trong khi owner vẫn có đường rút sớm.

## Câu 2 — Điểm hơn là gì?
Không cạnh tranh với wallet, bank app hay yield protocol.

Điểm khác biệt của PenguJar:
1. Savings goal rất dễ hiểu.
2. Lock rule onchain, không phải lời hứa từ backend.
3. Shared contribution nhưng quyền rút vẫn thuộc owner của jar.
4. Thiết kế gần với hành vi “bỏ heo/góp hũ” hơn DeFi terminology.

Lợi thế không phải công nghệ độc quyền. Lợi thế là **một UX tài chính nhỏ, rõ, local-first và có thể demo bằng giao dịch thật trên Arc**.

## Câu 3 — Có khả thi không?
**Pass cho MVP.**

Những mảnh đã đủ để build:
- Arc tương thích EVM và hỗ trợ Solidity/Hardhat.
- Arc Testnet chain ID: `5042002`.
- RPC: `https://rpc.testnet.arc.io`.
- USDC ERC-20 interface trên Arc Testnet: `0x3600000000000000000000000000000000000000`.
- Frontend có thể dùng `wagmi` + `viem`; `viem` có sẵn `arcTestnet` chain definition.

### Điều phải tự build
- Jar lifecycle và accounting.
- Shared contribution rules.
- Dashboard/jar details UX.
- Indexing strategy cho danh sách jar.
- Security tests và edge cases.

## Kết luận
**PASS — tiếp tục build.**

PenguJar đủ Arc-native khi USDC + P2P contribution + deterministic time-lock là core flow, không phải logo Arc dán lên một contract Ethereum chung chung.

## Nguồn tham chiếu
- https://github.com/KattyFury/build-on-arc
- https://docs.arc.io/arc-chain
- https://docs.arc.io/arc/references/connect-to-arc
- https://docs.arc.io/arc/references/contract-addresses
