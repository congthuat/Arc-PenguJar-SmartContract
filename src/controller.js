import { sum, multiply } from './utils.js';

export function runCalculations() {
  const num1 = 15;
  const num2 = 10;

  const resultSum = sum(num1, num2);
  const resultMultiply = multiply(num1, num2);

  console.log(`[Controller] Thực hiện tính toán với hai số: ${num1} và ${num2}`);
  console.log(`[Controller] Kết quả phép cộng (sum): ${resultSum}`);
  console.log(`[Controller] Kết quả phép nhân (multiply): ${resultMultiply}`);
}

// Tự động chạy khi được gọi trực tiếp hoặc qua import
runCalculations();
