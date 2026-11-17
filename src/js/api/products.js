const PRODUCTS_URL = 'https://world.openfoodfacts.org/';
const FIELDS = 'code,product_name,brands,image_front_small_url,nutriscore_grade,nova_group,quantity,nutriments';

export async function searchProducts(text) {
  const response = await fetch(
    PRODUCTS_URL + 'cgi/search.pl?search_terms=' + encodeURIComponent(text) +
    '&search_simple=1&action=process&json=1&page_size=24&fields=' + FIELDS
  );
  if (!response.ok) {
    throw new Error('Product search failed: ' + response.status);
  }
  const data = await response.json();
  return Array.isArray(data.products) ? data.products : [];
}

export async function getProductByBarcode(barcode) {
  const response = await fetch(
    PRODUCTS_URL + 'api/v0/product/' + encodeURIComponent(barcode) + '.json'
  );
  if (!response.ok) {
    throw new Error('Barcode lookup failed: ' + response.status);
  }

  const data = await response.json();

  if (data.status === 1) {
    return [data.product];
  }

  return [];
}

export async function getProductsByCategory(category) {
  const response = await fetch(
    PRODUCTS_URL + 'api/v2/search?categories_tags=' + encodeURIComponent(category) +
    '&page_size=24&fields=' + FIELDS
  );
  if (!response.ok) {
    throw new Error('Product category search failed: ' + response.status);
  }
  const data = await response.json();
  return Array.isArray(data.products) ? data.products : [];
}