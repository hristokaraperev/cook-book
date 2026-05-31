import { useAuthStore } from '../store/authStore'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

let tokenClient = null

export function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function initTokenClient(clientId) {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: async (response) => {
      if (response.error) {
        console.error('Auth error:', response.error)
        return
      }
      const { setAuth, setUser } = useAuthStore.getState()
      setAuth(response.access_token, parseInt(response.expires_in, 10))
      try {
        const user = await fetchUserInfo(response.access_token)
        setUser(user)
      } catch {
        // non-critical
      }
    },
  })
}

export function requestToken() {
  if (!tokenClient) throw new Error('Token client not initialized')
  tokenClient.requestAccessToken({ prompt: '' })
}

export function signOut() {
  const { accessToken, signOut: clearAuth } = useAuthStore.getState()
  if (accessToken) {
    window.google?.accounts?.oauth2?.revoke(accessToken)
  }
  clearAuth()
}

async function fetchUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user info')
  return res.json()
}

export function authFetch(url, options = {}) {
  const { accessToken } = useAuthStore.getState()
  if (!accessToken) throw new Error('Not authenticated')
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}
