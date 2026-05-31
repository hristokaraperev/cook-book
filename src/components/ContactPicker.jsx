import { useState, useEffect } from 'react'
import {
  Autocomplete, TextField, Chip, Avatar, Box, Typography, CircularProgress,
} from '@mui/material'
import { listContacts } from '../services/contactsService'

export default function ContactPicker({ value, onChange }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    listContacts()
      .then(setContacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Autocomplete
      multiple
      options={contacts}
      getOptionLabel={(o) => `${o.name} <${o.email}>`}
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      loading={loading}
      isOptionEqualToValue={(o, v) => o.email === v.email}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Recipients"
          placeholder="Search contacts..."
          error={Boolean(error)}
          helperText={error || 'Start typing to search your Google Contacts'}
          InputProps={{
            ...params.InputProps,
            endAdornment: loading ? <CircularProgress size={18} /> : params.InputProps.endAdornment,
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.email}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar src={option.photo} sx={{ width: 32, height: 32, fontSize: 14 }}>
              {option.name[0]}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={500}>{option.name}</Typography>
              <Typography variant="caption" color="text.secondary">{option.email}</Typography>
            </Box>
          </Box>
        </li>
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            key={option.email}
            avatar={<Avatar src={option.photo}>{option.name[0]}</Avatar>}
            label={option.name}
            size="small"
            {...getTagProps({ index })}
          />
        ))
      }
    />
  )
}
