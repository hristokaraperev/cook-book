import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container, Box, Typography, Chip, Stack, Button, IconButton,
  Paper, Divider, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Tooltip, LinearProgress,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import SendIcon from '@mui/icons-material/Send'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PeopleIcon from '@mui/icons-material/People'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useRecipeStore } from '../store/recipeStore'
import { deleteRecipeDoc } from '../services/driveService'
import { getRecipeDocumentStatus, isIncompleteSave } from '../services/recipeStatus'

const CATEGORY_EMOJI = {
  Breakfast: '🍳', Lunch: '🥗', Dinner: '🍽️', Dessert: '🍰', Snack: '🥨', Other: '🍴',
}

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recipes, removeRecipe } = useRecipeStore()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const recipe = recipes.find((r) => r.id === id)

  useEffect(() => {
    if (!recipe && recipes.length > 0) navigate('/', { replace: true })
  }, [recipe, recipes.length])

  if (!recipe) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
  const emoji = CATEGORY_EMOJI[recipe.category] || '🍴'
  const maxIngCal = Math.max(...(recipe.ingredients || []).map((i) => i.calories || 0), 1)
  const documentStatus = getRecipeDocumentStatus(recipe)
  const sharingBlocked = isIncompleteSave(recipe)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteRecipeDoc(recipe.id)
      removeRecipe(recipe.id)
      if (result?.cleanupFailed) {
        navigate('/', { state: { cleanupWarning: `"${recipe.name}" was deleted, but its Google Drive document could not be removed and may need manual cleanup.` } })
      } else {
        navigate('/')
      }
    } catch (e) {
      setDeleteError(e.message)
      setDeleting(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Edit recipe">
          <IconButton onClick={() => navigate(`/recipe/${id}/edit`)} color="primary">
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={sharingBlocked ? documentStatus.message : 'Send via email'}>
          <span>
            <IconButton
              onClick={() => navigate('/send', { state: { recipeId: id } })}
              color="primary"
              disabled={sharingBlocked}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
        {recipe.driveDocUrl && (
          <Tooltip title="Open in Google Drive">
            <IconButton href={recipe.driveDocUrl} target="_blank" rel="noopener noreferrer">
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete recipe">
          <IconButton onClick={() => setDeleteOpen(true)} color="error">
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {sharingBlocked && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate(`/recipe/${id}/edit`)}>
              Retry
            </Button>
          }
        >
          <Typography variant="subtitle2">{documentStatus.label}</Typography>
          <Typography variant="body2">{documentStatus.message}</Typography>
        </Alert>
      )}

      <Paper elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Box
          sx={{
            background: 'linear-gradient(135deg, #E65100 0%, #BF360C 100%)',
            color: 'white',
            p: 4,
            display: 'flex',
            gap: 3,
            alignItems: 'flex-start',
          }}
        >
          <Typography fontSize={72}>{emoji}</Typography>
          <Box sx={{ flexGrow: 1 }}>
            <Chip
              label={recipe.category}
              size="small"
              sx={{ mb: 1, backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            {sharingBlocked && (
              <Chip
                icon={<WarningAmberIcon />}
                label={documentStatus.label}
                size="small"
                sx={{ mb: 1, ml: 1, backgroundColor: 'rgba(255,255,255,0.9)' }}
                color="warning"
              />
            )}
            <Typography variant="h3" sx={{ color: 'white', mb: 1, lineHeight: 1.2 }}>
              {recipe.name}
            </Typography>
            {recipe.description && (
              <Typography sx={{ opacity: 0.85, fontSize: 15 }}>{recipe.description}</Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
            <StatBadge
              icon={<LocalFireDepartmentIcon />}
              value={`${recipe.caloriesPerServing || 0} kcal`}
              label="per serving"
              highlight
            />
            <StatBadge
              icon={<PeopleIcon />}
              value={recipe.servings || 1}
              label="servings"
            />
            {recipe.prepTime > 0 && (
              <StatBadge icon={<AccessTimeIcon />} value={`${recipe.prepTime} min`} label="prep" />
            )}
            {recipe.cookTime > 0 && (
              <StatBadge icon={<AccessTimeIcon />} value={`${recipe.cookTime} min`} label="cook" />
            )}
            {totalTime > 0 && (
              <StatBadge icon={<AccessTimeIcon />} value={`${totalTime} min`} label="total" />
            )}
          </Stack>

          <Divider sx={{ mb: 3 }} />

          <Typography variant="h5" gutterBottom>Ingredients</Typography>
          <Stack spacing={1} sx={{ mb: 4 }}>
            {(recipe.ingredients || []).map((ing, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ minWidth: 28, color: 'text.disabled', textAlign: 'right' }}>
                  <Typography variant="caption">{i + 1}</Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {ing.name}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {ing.amount} {ing.unit}
                      </Typography>
                    </Typography>
                    <Typography variant="caption" color="primary" fontWeight={600}>
                      {ing.calories || 0} kcal
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, ((ing.calories || 0) / maxIngCal) * 100)}
                    sx={{ height: 4, borderRadius: 2, '& .MuiLinearProgress-bar': { borderRadius: 2 } }}
                  />
                </Box>
              </Box>
            ))}
          </Stack>

          <Box
            sx={{
              background: 'linear-gradient(135deg, #FFF3E0 0%, #FFF8E1 100%)',
              borderRadius: 2,
              p: 2,
              mb: 4,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Total calories ({recipe.servings || 1} servings)
            </Typography>
            <Typography fontWeight={700} color="primary">
              {recipe.totalCalories || 0} kcal
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Typography variant="h5" gutterBottom>Instructions</Typography>
          <Stack spacing={2}>
            {(recipe.instructions || []).map((step, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2 }}>
                <Box
                  sx={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #E65100, #BF360C)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 700 }}>{i + 1}</Typography>
                </Box>
                <Typography variant="body1" sx={{ pt: 0.5, lineHeight: 1.7 }}>{step}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Paper>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs">
        <DialogTitle>Delete recipe?</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{recipe.name}</strong> will be permanently deleted, including its saved record and generated document.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" disabled={deleting} variant="contained">
            {deleting ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

function StatBadge({ icon, value, label, highlight }) {
  return (
    <Paper
      elevation={0}
      sx={{
        px: 2, py: 1.5, borderRadius: 2, textAlign: 'center',
        border: '1px solid', borderColor: highlight ? 'primary.light' : 'divider',
        background: highlight ? 'linear-gradient(135deg, #FFF3E0 0%, #FFF8E1 100%)' : 'transparent',
        minWidth: 90,
      }}
    >
      <Box sx={{ color: highlight ? 'primary.main' : 'text.secondary', mb: 0.3 }}>
        {icon}
      </Box>
      <Typography variant="h6" fontWeight={700} color={highlight ? 'primary.main' : 'text.primary'}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  )
}
