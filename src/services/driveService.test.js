import test from 'node:test'
import assert from 'node:assert/strict'
import { createRecipeDoc, listRecipes, updateRecipeDoc } from './driveService.js'
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

function multipartJsonContent(body) {
  const parts = String(body).split('--cookbook_boundary_789')
  const jsonParts = parts
    .filter((part) => part.includes('Content-Type: application/json; charset=UTF-8'))
    .map((part) => part.split('\r\n\r\n').at(1)?.trim())
    .filter(Boolean)
  return jsonParts.length ? JSON.parse(jsonParts.at(-1)) : null
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

test('updateRecipeDoc saves the Recipe Record and updates the existing Recipe Document in place', async (t) => {
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

    if (parsed.pathname.endsWith('/drive/v3/files/record-123') && parsed.searchParams.get('alt') === 'media') {
      return jsonResponse({
        ...sampleRecipe,
        name: 'Lemon Pasta',
        driveDocId: 'doc-789',
        driveDocUrl: 'https://docs.google.com/document/d/doc-789/edit',
        documentTemplateVersion: 1,
        recordSchemaVersion: 1,
      })
    }

    if (parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/doc-789') && parsed.searchParams.get('fields') === 'body(content(endIndex))') {
      return jsonResponse({ body: { content: [{ endIndex: 1 }, { endIndex: 120 }] } })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/doc-789:batchUpdate')) {
      return jsonResponse({})
    }

    if (options.method === 'PATCH' && parsed.pathname.endsWith('/upload/drive/v3/files/record-123')) {
      return jsonResponse({ id: 'record-123' })
    }

    throw new Error(`Unexpected request: ${options.method || 'GET'} ${request.url}`)
  }

  const updated = await updateRecipeDoc({
    id: 'record-123',
    ...sampleRecipe,
    name: 'Lemon Pasta',
    description: 'Brighter pasta with herbs',
    instructions: ['Boil pasta', 'Toss with lemon and basil'],
    updatedAt: '2026-06-03T11:00:00.000Z',
  })

  assert.equal(updated.id, 'record-123')
  assert.equal(updated.name, 'Lemon Pasta')
  assert.equal(updated.driveDocId, 'doc-789')
  assert.equal(updated.driveDocUrl, 'https://docs.google.com/document/d/doc-789/edit')

  const documentUpdate = calls.find(
    (call) => call.options.method === 'POST' && call.url.endsWith('/v1/documents/doc-789:batchUpdate')
  )
  assert.ok(documentUpdate, 'expected existing Recipe Document to be updated in place')
  const documentRequests = JSON.parse(documentUpdate.options.body).requests
  assert.deepEqual(documentRequests[0], {
    deleteContentRange: {
      range: { startIndex: 1, endIndex: 119 },
    },
  })
  assert.match(documentRequests[1].insertText.text, /^Lemon Pasta\n/)
  assert.match(documentRequests[1].insertText.text, /Toss with lemon and basil/)

  const recordUpdate = calls.find(
    (call) => call.options.method === 'PATCH' && call.url.includes('/upload/drive/v3/files/record-123')
  )
  assert.ok(recordUpdate, 'expected Recipe Record to be saved')
  const savedRecord = multipartJsonContent(recordUpdate.options.body)
  assert.equal(savedRecord.name, 'Lemon Pasta')
  assert.equal(savedRecord.updatedAt, '2026-06-03T11:00:00.000Z')
  assert.equal(savedRecord.driveDocId, 'doc-789')
})

test('updateRecipeDoc recreates a missing Recipe Document and patches the Recipe Record reference', async (t) => {
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

    if (parsed.pathname.endsWith('/drive/v3/files/record-123') && parsed.searchParams.get('alt') === 'media') {
      return jsonResponse({
        ...sampleRecipe,
        driveDocId: 'deleted-doc',
        driveDocUrl: 'https://docs.google.com/document/d/deleted-doc/edit',
        documentTemplateVersion: 1,
        recordSchemaVersion: 1,
      })
    }

    if (parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/deleted-doc') && parsed.searchParams.get('fields') === 'body(content(endIndex))') {
      return jsonResponse({ error: 'not found' }, { ok: false, status: 404 })
    }

    if (q.includes("name='Cookbook'")) {
      return jsonResponse({ files: [{ id: 'cookbook-folder' }] })
    }

    if (q.includes("name='.data'")) {
      return jsonResponse({ files: [{ id: 'record-folder' }] })
    }

    if (q.includes("name='Recipes'")) {
      return jsonResponse({ files: [{ id: 'document-folder' }] })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents')) {
      assert.equal(body.title, 'Lemon Pasta Rebuilt')
      return jsonResponse({ documentId: 'replacement-doc', title: 'Lemon Pasta Rebuilt' })
    }

    if (options.method !== 'PATCH' && parsed.pathname.endsWith('/drive/v3/files/replacement-doc')) {
      return jsonResponse({ parents: ['root'], webViewLink: 'https://docs.google.com/document/d/replacement-doc/edit' })
    }

    if (options.method === 'PATCH' && parsed.pathname.endsWith('/drive/v3/files/replacement-doc')) {
      return jsonResponse({ id: 'replacement-doc', webViewLink: 'https://docs.google.com/document/d/replacement-doc/edit' })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/replacement-doc:batchUpdate')) {
      return jsonResponse({})
    }

    if (options.method === 'PATCH' && parsed.pathname.endsWith('/upload/drive/v3/files/record-123')) {
      return jsonResponse({ id: 'record-123' })
    }

    throw new Error(`Unexpected request: ${options.method || 'GET'} ${request.url}`)
  }

  const updated = await updateRecipeDoc({
    id: 'record-123',
    ...sampleRecipe,
    name: 'Lemon Pasta Rebuilt',
    updatedAt: '2026-06-03T11:30:00.000Z',
  })

  assert.equal(updated.id, 'record-123')
  assert.equal(updated.driveDocId, 'replacement-doc')
  assert.equal(updated.driveDocUrl, 'https://docs.google.com/document/d/replacement-doc/edit')
  assert.equal(updated.documentTemplateVersion, 1)
  assert.equal(
    calls.some((call) => call.url.endsWith('/v1/documents/deleted-doc:batchUpdate')),
    false,
    'missing Recipe Document should not be updated after the read fails'
  )

  const recordUpdate = calls.find(
    (call) => call.options.method === 'PATCH' && call.url.includes('/upload/drive/v3/files/record-123')
  )
  const savedRecord = multipartJsonContent(recordUpdate.options.body)
  assert.equal(savedRecord.driveDocId, 'replacement-doc')
  assert.equal(savedRecord.driveDocUrl, 'https://docs.google.com/document/d/replacement-doc/edit')
  assert.equal(savedRecord.name, 'Lemon Pasta Rebuilt')
})

test('updateRecipeDoc renames the Recipe Record and Recipe Document without changing Recipe Identity', async (t) => {
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
    const contentType = options.headers?.['Content-Type'] || ''
    const body = options.body && contentType === 'application/json' ? JSON.parse(options.body) : null

    if (parsed.pathname.endsWith('/drive/v3/files/record-123') && parsed.searchParams.get('alt') === 'media') {
      return jsonResponse({
        ...sampleRecipe,
        name: 'Lemon Pasta',
        driveDocId: 'doc-789',
        driveDocUrl: 'https://docs.google.com/document/d/doc-789/edit',
        documentTemplateVersion: 1,
        recordSchemaVersion: 1,
      })
    }

    if (parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/doc-789') && parsed.searchParams.get('fields') === 'body(content(endIndex))') {
      return jsonResponse({ body: { content: [{ endIndex: 1 }, { endIndex: 88 }] } })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/doc-789:batchUpdate')) {
      return jsonResponse({})
    }

    if (options.method === 'PATCH' && parsed.pathname.endsWith('/upload/drive/v3/files/record-123')) {
      return jsonResponse({ id: 'record-123' })
    }

    if (options.method === 'PATCH' && parsed.pathname.endsWith('/drive/v3/files/doc-789')) {
      assert.deepEqual(body, { name: 'Lemon Pasta Primavera' })
      return jsonResponse({ id: 'doc-789', name: 'Lemon Pasta Primavera' })
    }

    throw new Error(`Unexpected request: ${options.method || 'GET'} ${request.url}`)
  }

  const updated = await updateRecipeDoc({
    id: 'record-123',
    ...sampleRecipe,
    name: 'Lemon Pasta Primavera',
    updatedAt: '2026-06-03T12:00:00.000Z',
  })

  assert.equal(updated.id, 'record-123')
  assert.equal(updated.driveDocId, 'doc-789')

  const recordUpdate = calls.find(
    (call) => call.options.method === 'PATCH' && call.url.includes('/upload/drive/v3/files/record-123')
  )
  const recordMetadata = multipartMetadata(recordUpdate.options.body)
  assert.match(recordMetadata.name, /^lemon-pasta-primavera-.+\.json$/)

  assert.ok(
    calls.some((call) => call.options.method === 'PATCH' && call.url.endsWith('/drive/v3/files/doc-789')),
    'expected generated Recipe Document name to be updated'
  )
})

test('updateRecipeDoc stamps the Recipe Record with the current save time when saving edits', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-03T12:30:00.000Z') })
  useAuthStore.setState({ accessToken: 'token', isSignedIn: true })
  useRecipeStore.setState({ cookbookFolderId: null })

  let savedRecord = null
  t.after(() => {
    globalThis.fetch = undefined
  })

  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url))

    if (parsed.pathname.endsWith('/drive/v3/files/record-123') && parsed.searchParams.get('alt') === 'media') {
      return jsonResponse({
        ...sampleRecipe,
        updatedAt: '2026-06-03T10:00:00.000Z',
        driveDocId: 'doc-789',
        driveDocUrl: 'https://docs.google.com/document/d/doc-789/edit',
        documentTemplateVersion: 1,
        recordSchemaVersion: 1,
      })
    }

    if (parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/doc-789') && parsed.searchParams.get('fields') === 'body(content(endIndex))') {
      return jsonResponse({ body: { content: [{ endIndex: 1 }, { endIndex: 90 }] } })
    }

    if (options.method === 'POST' && parsed.hostname === 'docs.googleapis.com' && parsed.pathname.endsWith('/v1/documents/doc-789:batchUpdate')) {
      return jsonResponse({})
    }

    if (options.method === 'PATCH' && parsed.pathname.endsWith('/upload/drive/v3/files/record-123')) {
      savedRecord = multipartJsonContent(options.body)
      return jsonResponse({ id: 'record-123' })
    }

    throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
  }

  const updated = await updateRecipeDoc({
    id: 'record-123',
    ...sampleRecipe,
    description: 'Saved later',
    updatedAt: undefined,
  })

  assert.equal(updated.updatedAt, '2026-06-03T12:30:00.000Z')
  assert.equal(savedRecord.updatedAt, '2026-06-03T12:30:00.000Z')
})
