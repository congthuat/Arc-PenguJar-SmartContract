// Dự án Học Code Arc
// File: src/index.js

import './controller.js';

console.log("=========================================");
console.log("🚀 Chào mừng bạn đến với dự án Học Code Arc!");
console.log("📂 File khởi tạo thành công tại: src/index.js");
console.log("👉 Bạn có thể bắt đầu viết code của mình tại đây.");
console.log("=========================================");

// ============================================================
// 🧪 BƯỚC 3: Giả lập (mock) gọi API / kết nối CSDL
// ============================================================

// 1) Dữ liệu giả lập — coi như đây là "bảng users" trong CSDL
const fakeDatabase = {
  users: [
    { id: 1, name: "Nguyễn Văn A", email: "a@example.com", role: "admin" },
    { id: 2, name: "Trần Thị B",   email: "b@example.com", role: "user"  },
    { id: 3, name: "Lê Văn C",     email: "c@example.com", role: "user"  },
  ],
};

// 2) Hàm mock trả về Promise sau 1 giây — giả lập độ trễ mạng
function fetchUsersFromAPI() {
  console.log("\n⏳ Đang gọi API lấy danh sách người dùng...");
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Giả lập tỉ lệ thành công 90%
      if (Math.random() < 0.9) {
        resolve(fakeDatabase.users);
      } else {
        reject(new Error("Không kết nối được tới server 😢"));
      }
    }, 1000);
  });
}

// 3) Hàm async để gọi và xử lý kết quả
async function main() {
  try {
    const users = await fetchUsersFromAPI();
    console.log(`✅ Lấy dữ liệu thành công! Có ${users.length} người dùng:\n`);

    // In bảng cho dễ nhìn
    console.table(users);

    // Ví dụ thêm: lọc ra admin
    const admins = users.filter((u) => u.role === "admin");
    console.log(`\n👑 Số admin: ${admins.length}`);
    admins.forEach((a) => console.log(`   - ${a.name} (${a.email})`));
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
  } finally {
    console.log("\n=========================================");
    console.log("🏁 Kết thúc chương trình.");
    console.log("=========================================");
  }
}

main();