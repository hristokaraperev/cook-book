import { useAuthStore } from '../store/authStore'
import { useRecipeStore } from '../store/recipeStore'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'My Cookbook'
const BOUNDARY = 'cookbook_boundary_789'

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
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
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

async function createFolder() {
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  if (!res.ok) throw new Error(`Failed to create folder: ${res.status}`)
  const data = await res.json()
  return data.id
}

// ─── Listing ─────────────────────────────────────────────────────────────────

export async function listRecipes() {
  const folderId = await ensureCookbookFolder()
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`
  )
  const fields = 'files(id,name,description,modifiedTime,createdTime,webViewLink)'
  const res = await fetch(
    `${DRIVE_API}/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error(`Drive list error: ${res.status}`)
  const data = await res.json()

  return (data.files || [])
    .map((file) => {
      try {
        const recipe = JSON.parse(file.description || '{}')
        return {
          ...recipe,
          id: file.id,
          driveDocUrl: file.webViewLink,
          updatedAt: file.modifiedTime,
          createdAt: file.createdTime,
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createRecipeDoc(recipe) {
  const folderId = await ensureCookbookFolder()
  const html = buildRecipeHtml(recipe)
  const recipeJson = JSON.stringify({ ...recipe, id: undefined })

  const metadata = {
    name: recipe.name,
    mimeType: 'application/vnd.google-apps.document',
    parents: [folderId],
    description: recipeJson,
  }

  const body = buildMultipartBody(metadata, html)
  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
    },
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create doc: ${res.status} ${err}`)
  }
  const file = await res.json()
  const webViewLink = await getFileWebViewLink(file.id)
  return { ...recipe, id: file.id, driveDocUrl: webViewLink }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateRecipeDoc(recipe) {
  const html = buildRecipeHtml(recipe)
  const recipeJson = JSON.stringify({ ...recipe, id: undefined, driveDocUrl: undefined })

  // Update file content
  const body = buildMultipartBody({}, html)
  const contentRes = await fetch(
    `${DRIVE_UPLOAD}/files/${recipe.id}?uploadType=multipart`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(),
        'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
      },
      body,
    }
  )
  if (!contentRes.ok) throw new Error(`Failed to update doc content: ${contentRes.status}`)

  // Update metadata (description with JSON)
  const metaRes = await fetch(`${DRIVE_API}/files/${recipe.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: recipe.name, description: recipeJson }),
  })
  if (!metaRes.ok) throw new Error(`Failed to update doc metadata: ${metaRes.status}`)

  return recipe
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteRecipeDoc(fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete: ${res.status}`)
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

function buildMultipartBody(metadata, htmlContent) {
  const metaPart = [
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
  ].join('\r\n')

  const contentPart = [
    `--${BOUNDARY}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlContent,
  ].join('\r\n')

  return `${metaPart}\r\n${contentPart}\r\n--${BOUNDARY}--`
}

function buildRecipeHtml(recipe) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
  const statCells = [
    { value: recipe.caloriesPerServing || 0, label: 'kcal / serving' },
    { value: recipe.servings || 1, label: 'servings' },
    recipe.prepTime ? { value: recipe.prepTime, label: 'min prep' } : null,
    recipe.cookTime ? { value: recipe.cookTime, label: 'min cook' } : null,
    totalTime ? { value: totalTime, label: 'min total' } : null,
  ]
    .filter(Boolean)
    .map(
      (stat) =>
        `<td class="stat">
          <div class="stat-value">${stat.value}</div>
          <div class="stat-label">${stat.label}</div>
        </td>`
    )
    .join('')
  const ingredientRows = (recipe.ingredients || [])
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0e0d0;">${i.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0e0d0;">${i.amount} ${i.unit}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0e0d0;text-align:right;">${i.calories} kcal</td>
        </tr>`
    )
    .join('')

  const instructionSteps = (recipe.instructions || [])
    .map((step, i) => `<li style="margin-bottom:10px;padding-left:4px;">${step}</li>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 750px; margin: auto; padding: 32px; color: #333; }
  h1 { color: #E65100; font-size: 32px; margin-bottom: 8px; }
  h2 { color: #BF360C; font-size: 18px; border-bottom: 2px solid #FF8F00; padding-bottom: 6px; margin-top: 28px; }
  .category { color: #FF8F00; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 13px; }
  .description { color: #666; font-size: 15px; margin: 12px 0 20px; }
  .stats { width: auto; background: #FFF8E1; border-radius: 10px; margin: 20px auto; border-collapse: collapse; }
  .stat { text-align: center; padding: 16px 10px; vertical-align: top; }
  .stat-value { font-size: 26px; font-weight: bold; color: #E65100; }
  .stat-label { font-size: 12px; color: #888; margin-top: 2px; }
  .ingredients-table { width: 90%; border-collapse: collapse; margin: 12px auto 0; }
  th { background: #FFF3E0; padding: 8px 12px; text-align: left; font-size: 13px; color: #888; }
  .total-box { background: #FFF3E0; border-radius: 8px; padding: 16px 24px; margin-top: 24px; text-align: center; font-size: 16px; }
  .total-kcal { font-size: 22px; font-weight: bold; color: #E65100; }
  ol { padding-left: 24px; line-height: 1.8; }
  footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px; color: #aaa; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<p class="category">${recipe.category || ''}</p>
<h1>${recipe.name}</h1>
${recipe.description ? `<p class="description">${recipe.description}</p>` : ''}
<table class="stats" align="center">
  <tbody>
    <tr>${statCells}</tr>
  </tbody>
</table>
<h2>Ingredients</h2>
<table class="ingredients-table" align="center">
  <thead>
    <tr>
      <th>Ingredient</th>
      <th>Amount</th>
      <th style="text-align:right">Calories</th>
    </tr>
  </thead>
  <tbody>${ingredientRows}</tbody>
</table>
<h2>Instructions</h2>
<ol>${instructionSteps}</ol>
<div class="total-box">
  <span class="total-kcal">${recipe.totalCalories || 0} kcal</span> total
  &nbsp;·&nbsp;
  <strong>${recipe.caloriesPerServing || 0} kcal</strong> per serving
</div>
<footer>Created with My Cookbook · ${new Date().toLocaleDateString()}</footer>
</body>
</html>`
}
