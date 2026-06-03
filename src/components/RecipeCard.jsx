import { useNavigate } from 'react-router-dom'
import {
  Card, CardActionArea, CardContent, Typography, Chip, Box, Stack,
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import PeopleIcon from '@mui/icons-material/People'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Tooltip } from '@mui/material'
import { getRecipeDocumentStatus } from '../services/recipeStatus'

const CATEGORY_EMOJI = {
  Breakfast: '🍳',
  Lunch: '🥗',
  Dinner: '🍽️',
  Dessert: '🍰',
  Snack: '🥨',
  Other: '🍴',
}

const CATEGORY_COLOR = {
  Breakfast: '#FF8F00',
  Lunch: '#388E3C',
  Dinner: '#E65100',
  Dessert: '#AD1457',
  Snack: '#1565C0',
  Other: '#546E7A',
}

export default function RecipeCard({ recipe }) {
  const navigate = useNavigate()
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
  const emoji = CATEGORY_EMOJI[recipe.category] || '🍴'
  const color = CATEGORY_COLOR[recipe.category] || '#546E7A'
  const documentStatus = getRecipeDocumentStatus(recipe)
  const showDocumentWarning = documentStatus.status !== 'ready'

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/recipe/${recipe.id}`)}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <Box
          sx={{
            background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 64,
            py: 2.5,
            borderBottom: `3px solid ${color}33`,
          }}
        >
          {emoji}
        </Box>
        <CardContent sx={{ flexGrow: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Chip
              label={recipe.category || 'Other'}
              size="small"
              sx={{ backgroundColor: `${color}22`, color, fontWeight: 600 }}
            />
            {showDocumentWarning && (
              <Tooltip title={documentStatus.message}>
                <Chip
                  icon={<WarningAmberIcon />}
                  label={documentStatus.label}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              </Tooltip>
            )}
          </Stack>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {recipe.name}
          </Typography>
          {recipe.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {recipe.description}
            </Typography>
          )}
          <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 'auto', pt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalFireDepartmentIcon sx={{ fontSize: 16, color: '#E65100' }} />
              <Typography variant="caption" fontWeight={600} color="primary">
                {recipe.caloriesPerServing || 0} kcal
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {recipe.servings || 1}
              </Typography>
            </Box>
            {totalTime > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {totalTime} min
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
