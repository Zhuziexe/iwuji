const fs = require('fs');
const path = require('path');

const FILE = path.join('assets', 'com.wujinb.wmall', 'products.json');

// 缺货概率表
// key: 有 colors 的商品用 `${productId}:${colorId}`，无 colors 的用 `${productId}`
const OUT_OF_STOCK_CHANCE = {
  'iwuji:blue':   0.5,
  'iwuji:white':  0.7,
  'iwuji:black':  0.5,
  'wujibuds:sky': 0.3,
  'wujibuds:blue':0.6,
  'charger':      0.2,
  'case':         0.1,
};

const raw = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(raw);

let changed = 0;
let total = 0;

for (const product of data.products || []) {
  const colors = Array.isArray(product.colors) ? product.colors : [];

  if (colors.length) {
    for (const color of colors) {
      const key = `${product.id}:${color.id}`;
      if (!(key in OUT_OF_STOCK_CHANCE)) continue;

      total++;
      const before = !!color.buyable;
      // 缺货概率 p  →  可购买概率 1-p
      const after = Math.random() >= OUT_OF_STOCK_CHANCE[key];
      if (before !== after) changed++;
      color.buyable = after;
    }
  } else {
    const key = product.id;
    if (!(key in OUT_OF_STOCK_CHANCE)) continue;

    total++;
    const before = product.buyable !== false;
    const after = Math.random() >= OUT_OF_STOCK_CHANCE[key];
    if (before !== after) changed++;
    product.buyable = after;
  }
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');

console.log(`[stock] checked ${total} SKUs, ${changed} changed`);