const now = new Date(1790590561999); // Simulating the time of Order 2
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

console.log("Order 1:", 1790529272095);
console.log("Order 2:", 1790590561999);
console.log("Start Month:", startOfMonth);
console.log("End Month:", endOfMonth);
console.log("Order 1 in range?", 1790529272095 >= startOfMonth && 1790529272095 <= endOfMonth);
console.log("Order 2 in range?", 1790590561999 >= startOfMonth && 1790590561999 <= endOfMonth);
