import test from 'node:test'
import assert from 'node:assert/strict'
import { createRecipeDoc, listRecipes, deleteRecipeDoc } from './driveService.js'
import { useAuthStore } from '../store/authStore.js'
import { useRecipeStore } from '../store/recipeStore.js'

const jsonResponse = (body, init = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  async json() {
    return body
  },
  async text() {
    return JSON.stringify(body)
  },
})

function multipartMetadata(body) {
  const match = String(body).match(/Content-Type: application\/json; charset=UTF-8\r\n\r\n(.+?)\r\n--/s)
  return match ? JSON.parse(match[1]) : null
}

const sampleRecipe = {
  name: 'Lemon Pasta',
  description: 'Bright weeknight pasta',
  category: 'Dinner',
  servings: 2,
  prepTime: 10,
  cookTime: 15,
  ingredients: [
    { name: 'Pasta', amount: 200, unit: 'g', calories: 700 },
    { name: 'Lemon', amount: 1, unit: 'piece', calories: 20 },
  ],
  instructions: ['Boil pasta', 'Toss with lemon'],
  totalCalories: 720,
  caloriesPerServing: 360,
  createdAt: '2026-06-03T10:00:00.000Z',
  updatedAt: '2026-06-03T10:00:00.000Z',
}

test('createRecipeDoc saves a Recipe Record first, then generates a Recipe Document from that record', async (t) => {
  useAuthStore.setState({ accessToken: 'token', isSignedIn: true })
  useRecipeStore.setState({ cookbookFolderId: null })

  const calls = []
  t.after(() => {
    globalThis.fetch = undefined
  })

  globalThis.fetch = async (url, options = {}) => {
    const request = { url: String(url), options }
    calls.push(request)
    const parsed = new URL(request.url)
    const q = parsed.searchParams.get('q') || ''
    const contentType = options.headers?.['Content-Type'] || ''
    const body = options.body && contentType === 'application/json' ? JSON.parse(options.body) : null

    if (options.method !== 'POST' && q.includes("name='Cookbook'")) {
      return jsonResponse({ files: [{ id: 'cookbook-folder' }] })
    }

    if (options.method !== 'POST' && q.includes("name='.data'")) {
      return jsonResponse({ files: [] })
    }

    if (options.method !== 'POST' && q.includes("name='Recipes'")) {
      return jsonResponse({ files: [] })
    }

    if (options.method === 'POST' && parsed.pathname.endsWith('/drive/v3/files') && body?.name === '.data') {
      return jsonResponse({ id: 'record-folder' })
    }

    if (options.method === 'POST' && parsed.pathname.endsWith('/drive/v3/files') && body?.name === 'Recipes') {
      return jsonResponse({ id: 'document-folder' })
    }

    if (options.method === 'POST' && parsed.pathname.endsWith('/upload/drive/v3/files') && String(options.body).includes('application/json')) {
      return jsonResponse({ id: 'record-123' })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents')) {
      return jsonResponse({ documentId: 'doc-789', title: 'Lemon Pasta' })
    }

    if (options.method !== 'POST' && parsed.pathname.endsWith('/drive/v3/files/doc-789')) {
      return jsonResponse({ parents: ['root'], webViewLink: 'https://docs.google.com/document/d/doc-789/edit' })
    }

    if (options.method === 'PATCH' && parsed.pathname.endsWith('/drive/v3/files/doc-789')) {
      return jsonResponse({ id: 'doc-789', webViewLink: 'https://docs.google.com/document/d/doc-789/edit' })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/doc-789:batchUpdate')) {
      return jsonResponse({})
    }

    if (options.method === 'PATCH' && parsed.pathname.endsWith('/upload/drive/v3/files/record-123')) {
      return jsonResponse({ id: 'record-123' })
    }

    throw new Error(`Unexpected request: ${options.method || 'GET'} ${request.url}`)
  }

  const created = await createRecipeDoc(sampleRecipe)

  assert.equal(created.id, 'record-123')
  assert.equal(created.driveDocId, 'doc-789')
  assert.equal(created.driveDocUrl, 'https://docs.google.com/document/d/doc-789/edit')
  assert.equal(created.documentTemplateVersion, 1)

  const recordCreateIndex = calls.findIndex(
    (call) => call.options.method === 'POST' && call.url.includes('/upload/drive/v3/files') && String(call.options.body).includes('application/json')
  )
  const documentCreateIndex = calls.findIndex(
    (call) => call.options.method === 'POST' && call.url.includes('https://docs.googleapis.com/v1/documents')
  )
  assert.ok(recordCreateIndex > -1, 'expected a Recipe Record file to be created')
  assert.ok(documentCreateIndex > -1, 'expected a Recipe Document to be created through the Docs API')
  assert.ok(recordCreateIndex < documentCreateIndex, 'Recipe Record must be created before the generated Recipe Document')
  assert.equal(
    calls.some((call) => String(call.options.body).includes('Content-Type: text/html')),
    false,
    'generated Recipe Documents must not be created via HTML upload conversion'
  )
})

test('listRecipes lists Recipe Records from .data and ignores old Google Docs', async (t) => {
  useAuthStore.setState({ accessToken: 'token', isSignedIn: true })
  useRecipeStore.setState({ cookbookFolderId: null })

  const calls = []
  t.after(() => {
    globalThis.fetch = undefined
  })

  globalThis.fetch = async (url, options = {}) => {
    const request = { url: String(url), options }
    calls.push(request)
    const parsed = new URL(request.url)
    const q = parsed.searchParams.get('q') || ''

    if (q.includes("mimeType='application/vnd.google-apps.document'")) {
      throw new Error('old-format Google Docs should not be queried for recipe listing')
    }

    if (q.includes("name='Cookbook'")) {
      return jsonResponse({ files: [{ id: 'cookbook-folder' }] })
    }

    if (q.includes("name='.data'")) {
      return jsonResponse({ files: [{ id: 'record-folder' }] })
    }

    if (q.includes("'record-folder' in parents") && q.includes("mimeType='application/json'")) {
      return jsonResponse({
        files: [
          {
            id: 'record-1',
            name: 'lemon-pasta-readable.json',
            createdTime: '2026-06-03T10:00:00.000Z',
            modifiedTime: '2026-06-03T10:30:00.000Z',
          },
        ],
      })
    }

    if (parsed.pathname.endsWith('/drive/v3/files/record-1') && parsed.searchParams.get('alt') === 'media') {
      return jsonResponse({
        name: 'Lemon Pasta',
        category: 'Dinner',
        servings: 2,
        ingredients: [],
        instructions: ['Boil pasta'],
        driveDocId: 'doc-789',
        driveDocUrl: 'https://docs.google.com/document/d/doc-789/edit',
        documentTemplateVersion: 1,
        recordSchemaVersion: 1,
      })
    }

    throw new Error(`Unexpected request: ${options.method || 'GET'} ${request.url}`)
  }

  const recipes = await listRecipes()

  assert.equal(recipes.length, 1)
  assert.equal(recipes[0].id, 'record-1')
  assert.equal(recipes[0].recordName, 'lemon-pasta-readable.json')
  assert.equal(recipes[0].driveDocId, 'doc-789')
  assert.equal(recipes[0].driveDocUrl, 'https://docs.google.com/document/d/doc-789/edit')
  assert.equal(
    calls.some((call) => call.url.includes('application/vnd.google-apps.document')),
    false,
    'old-format Google Docs must be ignored by the listing flow'
  )
})

test('createRecipeDoc allows duplicate recipe names by using disambiguated record filenames', async (t) => {
  useAuthStore.setState({ accessToken: 'token', isSignedIn: true })
  useRecipeStore.setState({ cookbookFolderId: null })

  const recordNames = []
  let recordNumber = 0
  let documentNumber = 0
  t.after(() => {
    globalThis.fetch = undefined
  })

  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url))
    const q = parsed.searchParams.get('q') || ''
    const contentType = options.headers?.['Content-Type'] || ''
    const body = options.body && contentType === 'application/json' ? JSON.parse(options.body) : null

    if (q.includes("name='Cookbook'")) {
      return jsonResponse({ files: [{ id: 'cookbook-folder' }] })
    }

    if (q.includes("name='.data'")) {
      return jsonResponse({ files: [{ id: 'record-folder' }] })
    }

    if (q.includes("name='Recipes'")) {
      return jsonResponse({ files: [{ id: 'document-folder' }] })
    }

    if (options.method === 'POST' && parsed.pathname.endsWith('/upload/drive/v3/files')) {
      const metadata = multipartMetadata(options.body)
      recordNames.push(metadata.name)
      recordNumber += 1
      return jsonResponse({ id: `record-${recordNumber}` })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents')) {
      documentNumber += 1
      return jsonResponse({ documentId: `doc-${documentNumber}`, title: body.title })
    }

    if (parsed.pathname.match(/\/drive\/v3\/files\/doc-\d+$/) && options.method !== 'PATCH') {
      const docId = parsed.pathname.split('/').at(-1)
      return jsonResponse({ parents: ['root'], webViewLink: `https://docs.google.com/document/d/${docId}/edit` })
    }

    if (parsed.pathname.match(/\/drive\/v3\/files\/doc-\d+$/) && options.method === 'PATCH') {
      const docId = parsed.pathname.split('/').at(-1)
      return jsonResponse({ id: docId, webViewLink: `https://docs.google.com/document/d/${docId}/edit` })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.match(/\/v1\/documents\/doc-\d+:batchUpdate$/)) {
      return jsonResponse({})
    }

    if (options.method === 'PATCH' && parsed.pathname.match(/\/upload\/drive\/v3\/files\/record-\d+$/)) {
      return jsonResponse({})
    }

    throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
  }

  const first = await createRecipeDoc(sampleRecipe)
  const second = await createRecipeDoc(sampleRecipe)

  assert.equal(first.id, 'record-1')
  assert.equal(second.id, 'record-2')
  assert.equal(recordNames.length, 2)
  assert.match(recordNames[0], /^lemon-pasta-.+\.json$/)
  assert.match(recordNames[1], /^lemon-pasta-.+\.json$/)
  assert.notEqual(recordNames[0], recordNames[1])
})

test('deleteRecipeDoc deletes the Recipe Record before the generated Recipe Document', async (t) => {
  useAuthStore.setState({ accessToken: 'token', isSignedIn: true })

  const deletedIds = []
  t.after(() => { globalThis.fetch = undefined })

  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url))

    if (parsed.pathname.endsWith('/drive/v3/files/record-1') && parsed.searchParams.get('alt') === 'media') {
      return jsonResponse({ name: 'Lemon Pasta', driveDocId: 'doc-1', recordSchemaVersion: 1 })
    }

    if (options.method === 'DELETE' && parsed.pathname.endsWith('/drive/v3/files/record-1')) {
      deletedIds.push('record-1')
      return { ok: true, status: 204, json: async () => ({}), text: async () => '' }
    }

    if (options.method === 'DELETE' && parsed.pathname.endsWith('/drive/v3/files/doc-1')) {
      deletedIds.push('doc-1')
      return { ok: true, status: 204, json: async () => ({}), text: async () => '' }
    }

    throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
  }

  await deleteRecipeDoc('record-1')

  assert.deepEqual(deletedIds, ['record-1', 'doc-1'], 'Recipe Record must be deleted before the generated Recipe Document')
})
