# 02 — Product Requirements Document

## 1. App này là gì?
PenguJar là dApp cho phép người dùng tạo nhiều “hũ” tiết kiệm bằng USDC, đặt mục tiêu và ngày mở khóa, nạp thêm theo thời gian và chia sẻ hũ để người khác cùng góp.

## 2. Ai sẽ dùng?
### Jar owner
Một người muốn tách riêng USDC cho một mục tiêu: chuyến đi, món đồ, quà, học phí hoặc quỹ cá nhân.

### Contributor
Bạn bè/người thân nhận link hũ và muốn góp USDC. Contributor không sở hữu hũ và không có quyền rút.

## 3. PenguJar mang lại điều gì?
- Biến “để dành” thành một cam kết có rule onchain.
- Cho phép nhiều người góp vào cùng một mục tiêu mà không trao quyền kiểm soát tiền cho contributor.
- Cho người dùng nhìn thấy mục tiêu, tiến độ và thời gian còn lại theo cách đơn giản.

## 4. MVP có những tính năng nào?
### P0 — bắt buộc
1. Connect wallet trên Arc Testnet.
2. Create Jar:
   - name
   - target amount (USDC)
   - unlock time
3. Multiple jars per owner.
4. Owner deposit khi tạo hoặc nạp thêm sau đó.
5. Public contribution bằng jar ID.
6. Progress = current amount / target amount.
7. Owner withdraw toàn bộ sau unlock.
8. Jar closed sau khi withdraw.
9. Transaction status + ArcScan link.

### P1 — chỉ làm sau khi P0 ổn
- Shareable jar URL.
- QR code cho jar URL.
- Basic activity list từ contract events.

### P2 — roadmap
- Gift Jar.
- Email/passkey onboarding.
- Sponsored gas.
- CCTP funding from other chains.
- Recurring/autonomous savings.

## 5. User flow
### Owner
Connect wallet → Create Jar → approve USDC if depositing → create/deposit → see dashboard → add more anytime before unlock → share jar → wait → withdraw after unlock.

### Contributor
Open shared jar → connect wallet → see goal/current/unlock → enter amount → approve USDC → contribute → receive confirmation.

## 6. App không được làm gì?
- Không hứa lợi nhuận/yield.
- Không stake user funds.
- Không swap tài sản.
- Không phát hành token riêng.
- Không cho owner rút trước hạn.
- Không cho contributor rút.
- Không có admin key để lấy tiền user.
- Không tự động bridge hoặc gửi tiền sang chain khác trong MVP.
- Không làm custodial backend giữ private key.

## Core value
**Một cam kết tiết kiệm chỉ đáng tin khi luật giữ tiền cũng rõ ràng và khó phá như mục tiêu mà người dùng đã đặt ra.**

## Success criteria cho demo
Demo được xem là đạt khi một người mới có thể:
1. tạo hai hũ khác nhau,
2. nạp USDC vào một hũ,
3. dùng ví thứ hai góp vào hũ đó,
4. nhìn thấy progress tăng,
5. bị chặn khi thử rút sớm,
6. rút thành công sau unlock trên Arc Testnet.
