import test from 'node:test'
import assert from 'node:assert/strict'
import { sendRecipeEmail } from './gmailService.js'

const shareableRecipe = {
  name: 'Lemon Pasta',
  category: 'Dinner',
  servings: 2,
  prepTime: 10,
  cookTime: 15,
  ingredients: [{ name: 'Pasta', amount: 200, unit: 'g', calories: 700 }],
  instructions: ['Boil pasta'],
  totalCalories: 700,
  caloriesPerServing: 350,
  driveDocUrl: 'https://docs.google.com/document/d/doc-1/edit',
  documentTemplateVersion: 1,
}

test('sendRecipeEmail blocks recipes with an Incomplete Save', async (t) => {
  const calls = []
  t.after(() => {
    globalThis.fetch = undefined
  })

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    return { ok: true, json: async () => ({ id: 'message-1' }) }
  }

  await assert.rejects(
    () => sendRecipeEmail('cook@example.com', { ...shareableRecipe, driveDocUrl: null }, ''),
    /complete the Recipe Document before sharing/
  )

  assert.equal(calls.length, 0, 'Gmail must not be called for an Incomplete Save')
})

test('sendRecipeEmail blocks recipes with an outdated generated document', async (t) => {
  const calls = []
  t.after(() => {
    globalThis.fetch = undefined
  })

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    return { ok: true, json: async () => ({ id: 'message-1' }) }
  }

  await assert.rejects(
    () => sendRecipeEmail(
      'cook@example.com',
      { ...shareableRecipe, documentTemplateVersion: 0 },
      '',
      shareableRecipe.driveDocUrl
    ),
    /complete the Recipe Document before sharing/
  )

  assert.equal(calls.length, 0, 'Gmail must not be called for an outdated generated document')
})
