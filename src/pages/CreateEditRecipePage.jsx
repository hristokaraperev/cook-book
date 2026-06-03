import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container, Box, Typography, TextField, Select, MenuItem, FormControl,
  InputLabel, Button, Paper, Stack, Divider, IconButton, Alert,
  CircularProgress, Stepper, Step, StepLabel, Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import { useRecipeStore } from '../store/recipeStore'
import { createRecipeDoc, updateRecipeDoc } from '../services/driveService'
import IngredientRow from '../components/IngredientRow'

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Other']

const emptyIngredient = () => ({
  id: Date.now() + Math.random(),
  name: '',
  fdcId: null,
  amount: 100,
  unit: 'g',
  caloriesPer100g: 0,
  calories: 0,
})

const emptyForm = {
  name: '',
  description: '',
  category: 'Dinner',
  servings: 4,
  prepTime: 15,
  cookTime: 30,
}

export default function CreateEditRecipePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { recipes, addRecipe, updateRecipeById } = useRecipeStore()

  const [form, setForm] = useState(emptyForm)
  const [ingredients, setIngredients] = useState([emptyIngredient()])
  const [instructions, setInstructions] = useState([''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isEdit) {
      const recipe = recipes.find((r) => r.id === id)
      if (recipe) {
        setForm({
          name: recipe.name || '',
          description: recipe.description || '',
          category: recipe.category || 'Dinner',
          servings: recipe.servings || 4,
          prepTime: recipe.prepTime || 0,
          cookTime: recipe.cookTime || 0,
        })
        setIngredients(
          recipe.ingredients?.length
            ? recipe.ingredients.map((i) => ({ ...i, id: Math.random() }))
            : [emptyIngredient()]
        )
        setInstructions(recipe.instructions?.length ? recipe.instructions : [''])
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [id])

  const totalCalories = ingredients.reduce((sum, i) => sum + (i.calories || 0), 0)
  const caloriesPerServing = form.servings > 0 ? Math.round(totalCalories / form.servings) : 0

  const updateIngredient = (index, updated) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? updated : ing)))
  }

  const removeIngredient = (index) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const addIngredient = () => setIngredients((prev) => [...prev, emptyIngredient()])

  const updateInstruction = (index, value) => {
    setInstructions((prev) => prev.map((s, i) => (i === index ? value : s)))
  }

  const addInstruction = () => setInstructions((prev) => [...prev, ''])

  const removeInstruction = (index) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Recipe name is required.'); return }
    const cleanIngredients = ingredients.filter((i) => i.name.trim())
    const cleanInstructions = instructions.filter((s) => s.trim())
    if (cleanIngredients.length === 0) { setError('Add at least one ingredient.'); return }
    if (cleanInstructions.length === 0) { setError('Add at least one instruction step.'); return }

    setError(null)
    setSaving(true)
    try {
      const recipe = {
        ...form,
        servings: Number(form.servings) || 1,
        prepTime: Number(form.prepTime) || 0,
        cookTime: Number(form.cookTime) || 0,
        ingredients: cleanIngredients,
        instructions: cleanInstructions,
        totalCalories,
        caloriesPerServing,
        updatedAt: new Date().toISOString(),
        createdAt: isEdit ? undefined : new Date().toISOString(),
      }

      if (isEdit) {
        const updated = await updateRecipeDoc({ ...recipe, id })
        updateRecipeById(id, updated)
        navigate(`/recipe/${id}`)
      } else {
        const created = await createRecipeDoc(recipe)
        addRecipe(created)
        navigate(`/recipe/${created.id}`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {isEdit ? 'Edit Recipe' : 'New Recipe'}
        </Typography>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ minWidth: 120 }}
        >
          {saving ? 'Saving…' : 'Save to Drive'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack spacing={3}>
        {/* Basic Info */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>Basic Info</Typography>
          <Stack spacing={2}>
            <TextField
              label="Recipe name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
              placeholder="A short description of this dish…"
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2 }}>
              <FormControl>
                <InputLabel>Category</InputLabel>
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Servings"
                type="number"
                value={form.servings}
                onChange={(e) => setForm({ ...form, servings: e.target.value })}
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Prep time (min)"
                type="number"
                value={form.prepTime}
                onChange={(e) => setForm({ ...form, prepTime: e.target.value })}
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Cook time (min)"
                type="number"
                value={form.cookTime}
                onChange={(e) => setForm({ ...form, cookTime: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Box>
          </Stack>
        </Paper>

        {/* Ingredients */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>Ingredients</Typography>
            <Chip
              icon={<LocalFireDepartmentIcon />}
              label={`${totalCalories} kcal total · ${caloriesPerServing} kcal/serving`}
              color="primary"
              variant="outlined"
              size="small"
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 80px 90px auto', sm: '1fr 90px 110px 80px auto' }, gap: 1, mb: 1, px: 1 }}>
            <Typography variant="caption" color="text.secondary">Ingredient</Typography>
            <Typography variant="caption" color="text.secondary">Amount</Typography>
            <Typography variant="caption" color="text.secondary">Unit</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Kcal</Typography>
            <span />
          </Box>

          <Stack spacing={0.5}>
            {ingredients.map((ing, index) => (
              <IngredientRow
                key={ing.id}
                ingredient={ing}
                index={index}
                onChange={(updated) => updateIngredient(index, updated)}
                onRemove={() => removeIngredient(index)}
              />
            ))}
          </Stack>

          <Button
            startIcon={<AddIcon />}
            onClick={addIngredient}
            sx={{ mt: 2 }}
            size="small"
            variant="outlined"
          >
            Add ingredient
          </Button>
        </Paper>

        {/* Instructions */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>Instructions</Typography>
          <Stack spacing={2}>
            {instructions.map((step, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #E65100, #BF360C)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 700 }}>{index + 1}</Typography>
                </Box>
                <TextField
                  value={step}
                  onChange={(e) => updateInstruction(index, e.target.value)}
                  multiline
                  fullWidth
                  minRows={2}
                  placeholder={`Step ${index + 1}…`}
                  size="small"
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeInstruction(index)}
                  disabled={instructions.length === 1}
                  sx={{ mt: 0.5 }}
                >
                  ✕
                </IconButton>
              </Box>
            ))}
          </Stack>
          <Button startIcon={<AddIcon />} onClick={addInstruction} sx={{ mt: 2 }} size="small" variant="outlined">
            Add step
          </Button>
        </Paper>

        {/* Calorie Summary */}
        <Paper
          elevation={0}
          sx={{ p: 3, background: 'linear-gradient(135deg, #FFF3E0 0%, #FFF8E1 100%)', border: '1px solid #FFE0B2' }}
        >
          <Typography variant="h6" gutterBottom fontWeight={600} color="primary">Calorie Summary</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 2 }}>
            {[
              { label: 'Total calories', value: `${totalCalories} kcal` },
              { label: 'Servings', value: form.servings || 1 },
              { label: 'Per serving', value: `${caloriesPerServing} kcal` },
            ].map((s) => (
              <Box key={s.label} sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="primary" fontWeight={700}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          fullWidth
        >
          {saving ? 'Saving to Google Drive…' : 'Save Recipe to Google Drive'}
        </Button>
      </Stack>
    </Container>
  )
}
