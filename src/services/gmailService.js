import { authFetch } from './googleAuth.js'
import { isIncompleteSave } from './recipeStatus.js'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'

export async function sendRecipeEmail(to, recipe, message, driveDocUrl) {
  if (isIncompleteSave({ ...recipe, driveDocUrl: driveDocUrl || recipe.driveDocUrl })) {
    throw new Error('Please complete the Recipe Document before sharing this recipe.')
  }

  const subject = `Recipe: ${recipe.name}`
  const html = buildEmailHtml(recipe, message, driveDocUrl)
  const raw = buildRawEmail(to, subject, html)

  const res = await authFetch(`${GMAIL_API}/users/me/messages/send`, {
    method: 'POST',
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Gmail API error: ${res.status}`)
  }
  return res.json()
}

function buildEmailHtml(recipe, message, driveDocUrl) {
  const ingredientRows = recipe.ingredients
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f0e0d0;">${i.name}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0e0d0;">${i.amount} ${i.unit}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0e0d0;text-align:right;">${i.calories} kcal</td>
        </tr>`
    )
    .join('')

  const instructionSteps = recipe.instructions
    .map((step, i) => `<li style="margin-bottom:8px;">${step}</li>`)
    .join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#FFF8F5;">
  <div style="background:#E65100;color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:28px;">${recipe.name}</h1>
    <p style="margin:8px 0 0;opacity:0.9;">${recipe.category}</p>
  </div>
  <div style="background:white;padding:24px;border-radius:0 0 12px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    ${message ? `<div style="background:#FFF3E0;border-left:4px solid #FF8F00;padding:12px 16px;border-radius:4px;margin-bottom:20px;">${message}</div>` : ''}
    <div style="display:flex;gap:16px;margin-bottom:20px;">
      <div style="background:#FFF8F5;padding:12px 16px;border-radius:8px;text-align:center;flex:1;">
        <div style="font-size:24px;font-weight:bold;color:#E65100;">${recipe.caloriesPerServing}</div>
        <div style="font-size:12px;color:#666;">kcal / serving</div>
      </div>
      <div style="background:#FFF8F5;padding:12px 16px;border-radius:8px;text-align:center;flex:1;">
        <div style="font-size:24px;font-weight:bold;color:#E65100;">${recipe.servings}</div>
        <div style="font-size:12px;color:#666;">servings</div>
      </div>
      <div style="background:#FFF8F5;padding:12px 16px;border-radius:8px;text-align:center;flex:1;">
        <div style="font-size:24px;font-weight:bold;color:#E65100;">${(recipe.prepTime || 0) + (recipe.cookTime || 0)}</div>
        <div style="font-size:12px;color:#666;">min total</div>
      </div>
    </div>
    ${recipe.description ? `<p style="color:#555;margin-bottom:20px;">${recipe.description}</p>` : ''}
    <h2 style="color:#E65100;border-bottom:2px solid #FF8F00;padding-bottom:8px;">Ingredients</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#FFF3E0;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;">Ingredient</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;">Amount</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#666;">Calories</th>
        </tr>
      </thead>
      <tbody>${ingredientRows}</tbody>
    </table>
    <h2 style="color:#E65100;border-bottom:2px solid #FF8F00;padding-bottom:8px;margin-top:24px;">Instructions</h2>
    <ol style="padding-left:20px;color:#444;">${instructionSteps}</ol>
    <div style="background:#FFF3E0;padding:16px;border-radius:8px;margin-top:20px;text-align:center;">
      <strong>Total: ${recipe.totalCalories} kcal</strong> for ${recipe.servings} servings
      ${driveDocUrl ? `<br><br><a href="${driveDocUrl}" style="color:#E65100;">📄 Open in Google Drive</a>` : ''}
    </div>
  </div>
  <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">Shared via My Cookbook App</p>
</body>
</html>`
}

function buildRawEmail(to, subject, html) {
  const email = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    html,
  ].join('\r\n')
  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
