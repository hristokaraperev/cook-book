import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Container, Grid, Typography, TextField, Chip, Stack, Fab,
  CircularProgress, Alert, Button, Paper, InputAdornment,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import GoogleIcon from '@mui/icons-material/Google'
import { useAuthStore } from '../store/authStore'
import { useRecipeStore } from '../store/recipeStore'
import { listRecipes } from '../services/driveService'
import { requestToken } from '../services/googleAuth'
import RecipeCard from '../components/RecipeCard'

const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Other']

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isSignedIn } = useAuthStore()
  const { recipes, loading, error, setRecipes, setLoading, setError } = useRecipeStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const cleanupWarning = location.state?.cleanupWarning || null

  useEffect(() => {
    if (isSignedIn) fetchRecipes()
  }, [isSignedIn])

  const fetchRecipes = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listRecipes()
      setRecipes(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isSignedIn) {
    return <LandingPage />
  }

  const filtered = recipes
    .filter((r) => !search || r.name?.toLowerCase().includes(search.toLowerCase()))
    .filter((r) => category === 'All' || r.category === category)

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flexGrow: 1, minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
          }}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              onClick={() => setCategory(c)}
              color={category === c ? 'primary' : 'default'}
              variant={category === c ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>
      </Box>

      {cleanupWarning && (
        <Alert severity="warning" sx={{ mb: 3 }}>{cleanupWarning}</Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} action={
          <Button size="small" onClick={fetchRecipes}>Retry</Button>
        }>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search || category !== 'All'} onAdd={() => navigate('/recipe/new')} />
      ) : (
        <Grid container spacing={3}>
          {filtered.map((recipe) => (
            <Grid item xs={12} sm={6} md={4} key={recipe.id}>
              <RecipeCard recipe={recipe} />
            </Grid>
          ))}
        </Grid>
      )}

      <Fab
        color="primary"
        onClick={() => navigate('/recipe/new')}
        sx={{ position: 'fixed', bottom: 32, right: 32 }}
        aria-label="Add recipe"
      >
        <AddIcon />
      </Fab>
    </Container>
  )
}

function LandingPage() {
  return (
    <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h1" sx={{ fontSize: { xs: 40, md: 56 }, mb: 2 }}>
            📖 My Cookbook
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 4, fontWeight: 300 }}>
            Create, store, and share your favourite recipes — beautifully formatted in Google Drive.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={requestToken}
            sx={{ px: 4, py: 1.5, fontSize: 16, borderRadius: 3 }}
          >
            Sign in with Google
          </Button>
          <Grid container spacing={3} alignItems="stretch" sx={{ mt: 6 }}>
            {[
              { icon: '🔍', title: 'Smart Nutrition', body: 'Look up ingredients from the USDA database and get auto-calculated calories per portion.' },
              { icon: '📄', title: 'Google Drive', body: 'Every recipe is saved as a beautifully formatted Google Doc in your Drive.' },
              { icon: '✉️', title: 'Share via Gmail', body: 'Send recipes to your contacts directly from your Gmail account.' },
            ].map((f) => (
              <Grid item xs={12} sm={4} key={f.title} sx={{ display: 'flex' }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    width: '100%',
                    minHeight: 190,
                    textAlign: 'center',
                    background: 'rgba(230,81,0,0.05)',
                    borderRadius: 3,
                  }}
                >
                  <Typography fontSize={36}>{f.icon}</Typography>
                  <Typography variant="h6" gutterBottom fontWeight={600}>{f.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{f.body}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  )
}

function EmptyState({ hasSearch, onAdd }) {
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <MenuBookIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {hasSearch ? 'No recipes match your search.' : 'Your cookbook is empty.'}
      </Typography>
      {!hasSearch && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ mt: 2 }}>
          Add your first recipe
        </Button>
      )}
    </Box>
  )
}
