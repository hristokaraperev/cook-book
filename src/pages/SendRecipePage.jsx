import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Container, Box, Typography, TextField, Button, Paper, Stack,
  Alert, CircularProgress, Autocomplete, Chip, Divider, IconButton, List, ListItem, ListItemText,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useRecipeStore } from '../store/recipeStore'
import { sendRecipeEmail } from '../services/gmailService'
import { grantViewerAccess } from '../services/driveService'
import { getRecipeDocumentStatus, isIncompleteSave } from '../services/recipeStatus'
import ContactPicker from '../components/ContactPicker'

export default function SendRecipePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { recipes } = useRecipeStore()

  const preselectedId = location.state?.recipeId
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [recipients, setRecipients] = useState([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sendResult, setSendResult] = useState(null)
  const selectedRecipeBlocked = selectedRecipe ? isIncompleteSave(selectedRecipe) : false
  const selectedRecipeStatus = selectedRecipe ? getRecipeDocumentStatus(selectedRecipe) : null

  useEffect(() => {
    if (preselectedId) {
      const r = recipes.find((r) => r.id === preselectedId)
      if (r) setSelectedRecipe(r)
    }
  }, [preselectedId, recipes])

  const handleSend = async () => {
    if (!selectedRecipe) { setError('Please select a recipe.'); return }
    if (selectedRecipeBlocked) { setError('Please complete the Recipe Document before sharing this recipe.'); return }
    if (!selectedRecipe.driveDocId) { setError('This recipe has no generated Recipe Document and cannot be shared.'); return }
    if (recipients.length === 0) { setError('Please select at least one recipient.'); return }

    setError(null)
    setSending(true)

    const succeeded = []
    const failed = []

    for (const contact of recipients) {
      try {
        await grantViewerAccess(selectedRecipe.driveDocId, contact.email)
        await sendRecipeEmail(contact.email, selectedRecipe, message, selectedRecipe.driveDocUrl)
        succeeded.push(contact)
      } catch (e) {
        failed.push({ contact, reason: e.message })
      }
    }

    setSending(false)
    setSendResult({ succeeded, failed })
  }

  if (sendResult) {
    const allFailed = sendResult.succeeded.length === 0
    const someFailed = sendResult.failed.length > 0

    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        {allFailed ? (
          <ErrorOutlineIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
        ) : (
          <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        )}

        <Typography variant="h4" gutterBottom>
          {allFailed ? 'Recipe Not Sent' : 'Recipe Sent!'}
        </Typography>

        {sendResult.succeeded.length > 0 && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            <strong>{selectedRecipe?.name}</strong> was sent to{' '}
            {sendResult.succeeded.map((r) => r.name).join(', ')}.
          </Typography>
        )}

        {someFailed && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            <Typography variant="subtitle2" gutterBottom>Could not send to:</Typography>
            <List dense disablePadding>
              {sendResult.failed.map(({ contact, reason }) => (
                <ListItem key={contact.email} disableGutters>
                  <ListItemText
                    primary={`${contact.name} (${contact.email})`}
                    secondary={reason}
                  />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="outlined" onClick={() => { setSendResult(null); setRecipients([]); setMessage('') }}>
            Send another
          </Button>
          <Button variant="contained" onClick={() => navigate('/')}>
            Back to cookbook
          </Button>
        </Stack>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
        <Typography variant="h4">Send a Recipe</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack spacing={3}>
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>Which recipe?</Typography>
          <Autocomplete
            options={recipes}
            getOptionLabel={(r) => r.name || ''}
            getOptionDisabled={(r) => isIncompleteSave(r)}
            value={selectedRecipe}
            onChange={(_, val) => setSelectedRecipe(val)}
            renderInput={(params) => (
              <TextField {...params} label="Select recipe" placeholder="Search your recipes…" />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={500}>{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{option.category}</Typography>
                  </Box>
                  <Chip
                    icon={<LocalFireDepartmentIcon />}
                    label={`${option.caloriesPerServing || 0} kcal`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  {isIncompleteSave(option) && (
                    <Chip
                      icon={<WarningAmberIcon />}
                      label={getRecipeDocumentStatus(option).label}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </Box>
              </li>
            )}
          />

          {selectedRecipeBlocked && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">{selectedRecipeStatus.label}</Typography>
              <Typography variant="body2">{selectedRecipeStatus.message}</Typography>
            </Alert>
          )}

          {selectedRecipe && (
            <Box sx={{ mt: 2, p: 2, background: '#FFF3E0', borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>{selectedRecipe.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedRecipe.category} · {selectedRecipe.servings} servings · {selectedRecipe.caloriesPerServing} kcal/serving
              </Typography>
              {selectedRecipe.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {selectedRecipe.description}
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>Who to send it to?</Typography>
          <ContactPicker value={recipients} onChange={setRecipients} />
        </Paper>

        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>Personal message (optional)</Typography>
          <TextField
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            rows={3}
            fullWidth
            placeholder="Hey, I thought you'd love this recipe! Give it a try…"
          />
        </Paper>

        {selectedRecipe && !selectedRecipeBlocked && recipients.length > 0 && (
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #FF8F00', background: '#FFFDE7' }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Preview</Typography>
            <Typography variant="body2">
              Sending <strong>{selectedRecipe.name}</strong> to{' '}
              {recipients.map((r) => <Chip key={r.email} label={r.name} size="small" sx={{ mx: 0.3 }} />)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Each recipient will be granted viewer access to the Recipe Document before receiving the email.
              The email will include the full ingredient list, calorie breakdown, instructions, and a link to the formatted document.
            </Typography>
          </Paper>
        )}

        <Button
          variant="contained"
          size="large"
          startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
          onClick={handleSend}
          disabled={sending || !selectedRecipe || selectedRecipeBlocked || recipients.length === 0}
          fullWidth
        >
          {sending
            ? `Sending to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}…`
            : `Send Recipe via Gmail`}
        </Button>
      </Stack>
    </Container>
  )
}
