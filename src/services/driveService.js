import { useAuthStore } from '../store/authStore.js'
import { useRecipeStore } from '../store/recipeStore.js'
import { CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION } from './recipeStatus.js'
import {
  buildRecipeDocumentTemplate,
  buildRecipeDocumentSkeleton,
  buildRecipeDocumentFormatting,
} from './recipeDocumentTemplate.js'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const DOCS_API = 'https://docs.googleapis.com/v1'
const FOLDER_NAME = 'Cookbook'
const RECORDS_FOLDER_NAME = '.data'
const DOCUMENTS_FOLDER_NAME = 'Recipes'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const RECORD_MIME_TYPE = 'application/json'
const RECIPE_RECORD_SCHEMA_VERSION = 1
const RECIPE_DOCUMENT_TEMPLATE_VERSION = CURRENT_RECIPE_DOCUMENT_TEMPLATE_VERSION
const BOUNDARY = 'cookbook_boundary_789'

export class IncompleteSaveError extends Error {
  constructor(message, recipe, cause) {
    super(message)
    this.name = 'IncompleteSaveError'
    this.recipe = recipe
    this.cause = cause
  }
}

function authHeaders() {
  const { accessToken } = useAuthStore.getState()
  if (!accessToken) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${accessToken}` }
}

// ─── Folder ──────────────────────────────────────────────────────────────────

export async function ensureCookbookFolder() {
  const { cookbookFolderId, setCookbookFolderId } = useRecipeStore.getState()
  if (cookbookFolderId) return cookbookFolderId

  const q = encodeURIComponent(
    `name='${escapeDriveQueryValue(FOLDER_NAME)}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`
  )
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`)
  const data = await res.json()

  let folderId
  if (data.files?.length) {
    folderId = data.files[0].id
  } else {
    folderId = await createFolder()
  }
  setCookbookFolderId(folderId)
  return folderId
}

async function ensureRecipeFolders() {
  const cookbookFolderId = await ensureCookbookFolder()
  const [recordFolderId, documentFolderId] = await Promise.all([
    ensureChildFolder(RECORDS_FOLDER_NAME, cookbookFolderId),
    ensureChildFolder(DOCUMENTS_FOLDER_NAME, cookbookFolderId),
  ])

  return { cookbookFolderId, recordFolderId, documentFolderId }
}

async function ensureChildFolder(name, parentId) {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${escapeDriveQueryValue(name)}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`
  )
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`)
  const data = await res.json()

  if (data.files?.length) return data.files[0].id
  return createFolder(name, parentId)
}

async function createFolder(name = FOLDER_NAME, parentId = null) {
  const metadata = {
    name,
    mimeType: FOLDER_MIME_TYPE,
  }
  if (parentId) metadata.parents = [parentId]

  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })
  if (!res.ok) throw new Error(`Failed to create folder: ${res.status}`)
  const data = await res.json()
  return data.id
}

// ─── Listing ─────────────────────────────────────────────────────────────────

export async function listRecipes() {
  const cookbookFolderId = await ensureCookbookFolder()
  const recordFolderId = await ensureChildFolder(RECORDS_FOLDER_NAME, cookbookFolderId)
  const q = encodeURIComponent(
    `'${recordFolderId}' in parents and mimeType='${RECORD_MIME_TYPE}' and trashed=false`
  )
  const fields = 'files(id,name,modifiedTime,createdTime)'
  const res = await fetch(
    `${DRIVE_API}/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error(`Drive list error: ${res.status}`)
  const data = await res.json()

  const recipes = await Promise.all(
    (data.files || []).map(async (file) => {
      try {
        const record = await readJsonFile(file.id)
        return recipeFromRecord(record, file.id, file)
      } catch {
        return null
      }
    })
  )

  return recipes.filter(Boolean)
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createRecipeDoc(recipe) {
  const { recordFolderId, documentFolderId } = await ensureRecipeFolders()
  const recordName = buildRecordFileName(recipe.name)
  const initialRecord = buildRecipeRecord(recipe)
  const recordFile = await createJsonFile(recordName, initialRecord, recordFolderId)
  const recipeIdentity = recordFile.id

  let savedRecord = initialRecord
  try {
    const document = await createGeneratedRecipeDocument(
      { ...recipe, id: recipeIdentity },
      documentFolderId
    )
    savedRecord = buildRecipeRecord(recipe, {
      driveDocId: document.id,
      driveDocUrl: document.webViewLink,
    })
    await updateJsonFile(recipeIdentity, savedRecord)
  } catch (error) {
    throw new IncompleteSaveError(
      'Incomplete Save: the Recipe Record was saved, but the generated Recipe Document could not be completed.',
      recipeFromRecord(savedRecord, recipeIdentity, recordFile),
      error
    )
  }

  return recipeFromRecord(savedRecord, recipeIdentity)
}

async function createJsonFile(name, data, parentId) {
  const metadata = {
    name,
    mimeType: RECORD_MIME_TYPE,
    parents: [parentId],
  }

  const body = buildMultipartBody(metadata, JSON.stringify(data, null, 2), RECORD_MIME_TYPE)
  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
    },
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create recipe record: ${res.status} ${err}`)
  }
  return res.json()
}

async function updateJsonFile(fileId, data, metadata = {}) {
  const body = buildMultipartBody(metadata, JSON.stringify(data, null, 2), RECORD_MIME_TYPE)
  const res = await fetch(`${DRIVE_UPLOAD}/files/${fileId}?uploadType=multipart`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
    },
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to update recipe record: ${res.status} ${err}`)
  }
}

async function readJsonFile(fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to read recipe record: ${res.status}`)
  return res.json()
}

async function createGeneratedRecipeDocument(recipe, documentFolderId) {
  const createRes = await fetch(`${DOCS_API}/documents`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: recipe.name }),
  })
  if (!createRes.ok) throw new Error(`Failed to create recipe document: ${createRes.status}`)
  const created = await createRes.json()
  const documentId = created.documentId

  const file = await getFileMetadata(documentId, 'parents,webViewLink')
  const moved = await moveFileToFolder(documentId, documentFolderId, file.parents || [])
  await writeRecipeDocument(documentId, recipe)

  return {
    id: documentId,
    webViewLink: moved.webViewLink || file.webViewLink || (await getFileWebViewLink(documentId)),
  }
}

async function getFileMetadata(fileId, fields) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=${fields}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to read file metadata: ${res.status}`)
  return res.json()
}

async function moveFileToFolder(fileId, folderId, currentParents) {
  const params = new URLSearchParams({
    addParents: folderId,
    fields: 'id,webViewLink',
  })
  if (currentParents.length) params.set('removeParents', currentParents.join(','))

  const res = await fetch(`${DRIVE_API}/files/${fileId}?${params.toString()}`, {
    method: 'PATCH',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to move recipe document: ${res.status}`)
  return res.json()
}

async function updateDriveFileMetadata(fileId, metadata) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })
  if (!res.ok) throw new Error(`Failed to update file metadata: ${res.status}`)
  return res.json()
}

// Writes a formatted Recipe Document in two passes: first append the skeleton
// (paragraphs and an empty table) without index math, then read the document back
// and apply table cell text and styling at the real indices Google assigns.
async function writeRecipeDocument(documentId, recipe, options = {}) {
  const template = buildRecipeDocumentTemplate(recipe)

  const skeleton = buildRecipeDocumentSkeleton(template)
  if (options.replace) {
    const endIndex = await getDocumentEndIndex(documentId)
    if (endIndex > 2) {
      skeleton.unshift({
        deleteContentRange: {
          range: { startIndex: 1, endIndex: endIndex - 1 },
        },
      })
    }
  }
  await batchUpdateDocument(documentId, skeleton)

  const content = await getDocumentContent(documentId)
  const formatting = buildRecipeDocumentFormatting(template, content)
  if (formatting.length) await batchUpdateDocument(documentId, formatting)
}

async function batchUpdateDocument(documentId, requests) {
  if (!requests.length) return
  const res = await fetch(`${DOCS_API}/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
  if (!res.ok) throw new Error(`Failed to write recipe document: ${res.status}`)
}

async function getDocumentContent(documentId) {
  const res = await fetch(`${DOCS_API}/documents/${documentId}?fields=body(content)`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to read recipe document: ${res.status}`)
  const document = await res.json()
  return document.body?.content || []
}

async function getDocumentEndIndex(documentId) {
  const res = await fetch(`${DOCS_API}/documents/${documentId}?fields=body(content(endIndex))`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to read recipe document: ${res.status}`)
  const document = await res.json()
  const content = document.body?.content || []
  return content.at(-1)?.endIndex || 1
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateRecipeDoc(recipe) {
  const existingRecord = await readJsonFile(recipe.id)
  const isRename = Boolean(recipe.name && recipe.name !== existingRecord.name)
  let mergedRecord = buildRecipeRecord({
    ...existingRecord,
    ...recipe,
    createdAt: recipe.createdAt || existingRecord.createdAt,
    updatedAt: recipe.updatedAt || new Date().toISOString(),
    driveDocId: recipe.driveDocId || existingRecord.driveDocId,
    driveDocUrl: recipe.driveDocUrl || existingRecord.driveDocUrl,
    documentTemplateVersion: RECIPE_DOCUMENT_TEMPLATE_VERSION,
  })

  try {
    if (mergedRecord.driveDocId) {
      try {
        await writeRecipeDocument(mergedRecord.driveDocId, { ...mergedRecord, id: recipe.id }, { replace: true })
      } catch {
        const { documentFolderId } = await ensureRecipeFolders()
        const document = await createGeneratedRecipeDocument(
          { ...mergedRecord, id: recipe.id },
          documentFolderId
        )
        mergedRecord = buildRecipeRecord(mergedRecord, {
          driveDocId: document.id,
          driveDocUrl: document.webViewLink,
          documentTemplateVersion: RECIPE_DOCUMENT_TEMPLATE_VERSION,
        })
      }
    } else {
      const { documentFolderId } = await ensureRecipeFolders()
      const document = await createGeneratedRecipeDocument(
        { ...mergedRecord, id: recipe.id },
        documentFolderId
      )
      mergedRecord = buildRecipeRecord(mergedRecord, {
        driveDocId: document.id,
        driveDocUrl: document.webViewLink,
        documentTemplateVersion: RECIPE_DOCUMENT_TEMPLATE_VERSION,
      })
    }

    if (isRename && mergedRecord.driveDocId) {
      await updateDriveFileMetadata(mergedRecord.driveDocId, { name: mergedRecord.name })
    }

    const recordMetadata = isRename ? { name: buildRecordFileName(mergedRecord.name) } : {}
    await updateJsonFile(recipe.id, mergedRecord, recordMetadata)
  } catch (error) {
    throw new IncompleteSaveError(
      'Incomplete Save: the Recipe Record and generated Recipe Document could not both be completed.',
      recipeFromRecord(mergedRecord, recipe.id),
      error
    )
  }

  return recipeFromRecord(mergedRecord, recipe.id)
}

// ─── Permissions ─────────────────────────────────────────────────────────────

export async function grantViewerAccess(fileId, emailAddress) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'user', emailAddress }),
  })
  if (!res.ok) throw new Error(`Failed to grant viewer access: ${res.status}`)
  return res.json()
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteRecipeDoc(fileId) {
  let record = null
  try {
    record = await readJsonFile(fileId)
  } catch {
    record = null
  }

  await deleteDriveFile(fileId)

  if (record?.driveDocId) {
    try {
      await deleteDriveFile(record.driveDocId)
    } catch {
      return { cleanupFailed: true }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getFileWebViewLink(fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=webViewLink`, {
    headers: authHeaders(),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.webViewLink
}

async function deleteDriveFile(fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete: ${res.status}`)
}

function buildMultipartBody(metadata, content, contentType) {
  const metaPart = [
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
  ].join('\r\n')

  const contentPart = [
    `--${BOUNDARY}`,
    `Content-Type: ${contentType}; charset=UTF-8`,
    '',
    content,
  ].join('\r\n')

  return `${metaPart}\r\n${contentPart}\r\n--${BOUNDARY}--`
}

function buildRecipeRecord(recipe, document = {}) {
  const {
    id,
    driveDocId,
    driveDocUrl,
    documentTemplateVersion,
    recordSchemaVersion,
    ...recipeData
  } = recipe

  return {
    ...recipeData,
    driveDocId: document.driveDocId ?? driveDocId ?? null,
    driveDocUrl: document.driveDocUrl ?? driveDocUrl ?? null,
    documentTemplateVersion:
      document.documentTemplateVersion ?? documentTemplateVersion ?? RECIPE_DOCUMENT_TEMPLATE_VERSION,
    recordSchemaVersion: recordSchemaVersion ?? RECIPE_RECORD_SCHEMA_VERSION,
  }
}

function recipeFromRecord(record, recordId, file = {}) {
  return {
    ...record,
    id: recordId,
    recordName: file.name,
    createdAt: record.createdAt || file.createdTime,
    updatedAt: record.updatedAt || file.modifiedTime,
  }
}

function buildRecordFileName(name) {
  const readable = (name || 'recipe')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'recipe'
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `${readable}-${suffix}.json`
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/'/g, "\\'")
}
