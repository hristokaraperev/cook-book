import { authFetch } from './googleAuth'

const PEOPLE_API = 'https://people.googleapis.com/v1'

export async function listContacts() {
  const params = new URLSearchParams({
    resourceName: 'people/me',
    pageSize: '100',
    personFields: 'names,emailAddresses,photos',
  })
  const res = await authFetch(
    `${PEOPLE_API}/people/me/connections?${params}`
  )
  if (!res.ok) throw new Error(`Contacts API error: ${res.status}`)
  const data = await res.json()
  return (data.connections || [])
    .filter((p) => p.emailAddresses?.length)
    .map((p) => ({
      name: p.names?.[0]?.displayName || 'Unknown',
      email: p.emailAddresses[0].value,
      photo: p.photos?.[0]?.url || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
