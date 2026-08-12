# 03 — Product Decisions & Edge Cases

## Quyết định đã chốt

### D1 — Một ví có nhiều jar
Không dùng `mapping(address => Jar)` như prototype cũ. V2 dùng `jarId` toàn cục để một owner có thể tạo nhiều jar.

### D2 — Shared contribution là public-by-ID
Bất kỳ wallet nào biết jar ID đều có thể contribute trước khi jar closed.

Lý do: MVP đơn giản và thể hiện P2P rõ nhất. “Private/allowlist jar” để sau.

### D3 — Contributor không có claim
Contribute là chuyển USDC vào jar của owner. Contributor không nhận share token, NFT hay quyền rút.

UI phải ghi rõ điều này trước khi ký giao dịch.

### D4 — Unlock time bất biến sau khi jar có tiền
Owner không thể kéo dài hoặc rút ngắn thời hạn sau deposit đầu tiên.

Lý do: contributor phải biết điều kiện của jar không thể bị owner thay đổi sau khi họ góp.

### D5 — Target amount không tự mở khóa
Đạt 100% target không cho phép rút sớm. Unlock chỉ phụ thuộc thời gian.

Lý do: tránh hai điều kiện cạnh tranh và giữ mental model rất rõ.

### D6 — Có thể nạp thêm sau khi đạt target
Target là mục tiêu UX, không phải hard cap. Jar có thể đạt 120%.

### D7 — Không nhận contribution sau khi jar đã unlock
Khi `block.timestamp >= unlockTime`, jar chuyển sang trạng thái “Ready to withdraw”; deposit/contribute mới bị chặn.

Lý do: tránh người khác vô tình góp ngay trước lúc owner rút và giữ lifecycle sạch.

### D8 — Withdraw một lần, toàn bộ
Owner rút toàn bộ balance sau unlock. Jar chuyển `Closed`.

Partial withdrawal để sau.

### D9 — Jar name giới hạn ngắn
Contract V2 nên giới hạn name length hợp lý (ví dụ <= 64 bytes) hoặc dùng metadata hash nếu gas trở thành vấn đề.

MVP ưu tiên UX dễ hiểu hơn tối ưu storage cực đoan.

### D10 — Target amount > 0
Tạo jar phải có target > 0. Deposit ban đầu có thể bằng 0 để user tạo jar trước rồi nạp sau, nhưng unlock time vẫn được chốt lúc tạo.

Nếu team muốn tối giản contract hơn, có thể yêu cầu deposit ban đầu > 0; Codex phải giữ quyết định nhất quán giữa contract và UI.

## State machine
`Active` → `ReadyToWithdraw` → `Closed`

- Active: trước unlock; create/add/contribute được phép.
- ReadyToWithdraw: đã tới unlock; chỉ owner withdraw.
- Closed: đã withdraw; không nhận thêm tiền.

## Edge cases cần test
- create target = 0
- unlock time trong quá khứ
- name rỗng/quá dài
- deposit 0
- contribute 0
- contribute vào jar không tồn tại
- contribute vào jar đã unlock
- contribute vào jar closed
- non-owner withdraw
- owner withdraw trước hạn
- withdraw lần hai
- nhiều jar của cùng owner
- contributor góp nhiều lần
- accounting của jar A không ảnh hưởng jar B
