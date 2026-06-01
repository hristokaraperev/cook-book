const BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

const GRAMS_PER_UNIT = {
  g: 1,
  kg: 1000,
  oz: 28.35,
  lb: 453.59,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  ml: 1,
  l: 1000,
  piece: 100,
  slice: 30,
  clove: 5,
}

export const UNITS = Object.keys(GRAMS_PER_UNIT)

function getApiKey() {
  return import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'
}

export async function searchFoods(query) {
  if (!query || query.trim().length < 2) return []
  const params = new URLSearchParams({
    query: query.trim(),
    api_key: getApiKey(),
    pageSize: '10',
    dataType: 'Foundation,SR Legacy',
  })
  const res = await fetch(`${BASE_URL}/foods/search?${params}`)
  if (!res.ok) throw new Error(`USDA API error: ${res.status}`)
  const data = await res.json()
  return (data.foods || []).map((food) => ({
    fdcId: String(food.fdcId),
    name: food.description,
    caloriesPer100g: extractCalories(food.foodNutrients),
  }))
}

function extractCalories(nutrients = []) {
  const kcal = nutrients.find(
    (n) =>
      (n.nutrientName === 'Energy' || n.nutrientName === 'Energy (Atwater General Factors)') &&
      n.unitName === 'kcal'
  )
  return kcal?.value ?? 0
}

export function calculateCalories(caloriesPer100g, amount, unit) {
  const grams = (GRAMS_PER_UNIT[unit] ?? 100) * (amount || 0)
  return Math.round((grams / 100) * caloriesPer100g)
}
