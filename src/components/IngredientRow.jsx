import { useState, useEffect, useRef } from 'react'
import {
  Box, TextField, Select, MenuItem, FormControl, IconButton,
  Autocomplete, Typography, CircularProgress, InputAdornment,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import { searchFoods, calculateCalories, UNITS } from '../services/usdaService'

export default function IngredientRow({ ingredient, onChange, onRemove, index }) {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState(ingredient.name || '')
  const debounceRef = useRef(null)

  useEffect(() => {
    setInputValue(ingredient.name || '')
  }, [ingredient.name])

  const handleNameChange = (value) => {
    setInputValue(value)
    clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setOptions([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchFoods(value)
        setOptions(results)
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  const handleFoodSelect = (food) => {
    if (!food) return
    const calories = calculateCalories(food.caloriesPer100g, ingredient.amount || 100, ingredient.unit || 'g')
    onChange({ ...ingredient, name: food.name, fdcId: food.fdcId, caloriesPer100g: food.caloriesPer100g, calories })
  }

  const handleAmountChange = (amount) => {
    const num = parseFloat(amount) || 0
    const calories = calculateCalories(ingredient.caloriesPer100g || 0, num, ingredient.unit || 'g')
    onChange({ ...ingredient, amount: num, calories })
  }

  const handleUnitChange = (unit) => {
    const calories = calculateCalories(ingredient.caloriesPer100g || 0, ingredient.amount || 0, unit)
    onChange({ ...ingredient, unit, calories })
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 80px 90px auto', sm: '1fr 90px 110px 80px auto' },
        gap: 1,
        alignItems: 'center',
        p: 1,
        borderRadius: 2,
        backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
      }}
    >
      <Autocomplete
        freeSolo
        options={options}
        getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
        inputValue={inputValue}
        onInputChange={(_, val) => handleNameChange(val)}
        onChange={(_, val) => {
          if (val && typeof val === 'object') handleFoodSelect(val)
          else onChange({ ...ingredient, name: val || '', fdcId: null, caloriesPer100g: 0, calories: 0 })
        }}
        loading={loading}
        size="small"
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Ingredient name"
            InputProps={{
              ...params.InputProps,
              endAdornment: loading ? <CircularProgress size={16} /> : params.InputProps.endAdornment,
            }}
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.fdcId}>
            <Box>
              <Typography variant="body2">{option.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {option.caloriesPer100g} kcal / 100g
              </Typography>
            </Box>
          </li>
        )}
      />
      <TextField
        size="small"
        type="number"
        placeholder="Amount"
        value={ingredient.amount || ''}
        onChange={(e) => handleAmountChange(e.target.value)}
        inputProps={{ min: 0, step: 'any' }}
      />
      <FormControl size="small">
        <Select
          value={ingredient.unit || 'g'}
          onChange={(e) => handleUnitChange(e.target.value)}
        >
          {UNITS.map((u) => (
            <MenuItem key={u} value={u}>{u}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          gap: 0.3,
          color: 'primary.main',
          minWidth: 70,
        }}
      >
        <LocalFireDepartmentIcon sx={{ fontSize: 14 }} />
        <Typography variant="caption" fontWeight={600}>{ingredient.calories || 0}</Typography>
      </Box>
      <IconButton size="small" onClick={onRemove} color="error" sx={{ ml: 'auto' }}>
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}
