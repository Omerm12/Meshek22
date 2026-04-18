// scripts/lib/loadProducts.js
// Read-only: loads local product catalog from data/products.full.json
// No writes, no DB access.

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @returns {{ id: string, slug: string, name: string }[]}
 */
function loadProducts() {
  const filePath = path.resolve(__dirname, '../../data/products.full.json');

  if (!fs.existsSync(filePath)) {
    throw new Error(`products.full.json not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const products = JSON.parse(raw);

  if (!Array.isArray(products)) {
    throw new Error('products.full.json must be a JSON array');
  }

  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
  }));
}

module.exports = { loadProducts };
