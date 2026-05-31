import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar, Toolbar, Typography, Button, Avatar, Box, Menu, MenuItem,
  Divider, IconButton, Tooltip, useMediaQuery, useTheme,
} from '@mui/material'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import AddIcon from '@mui/icons-material/Add'
import SendIcon from '@mui/icons-material/Send'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuthStore } from '../store/authStore'
import { signOut } from '../services/googleAuth'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { user, isSignedIn } = useAuthStore()
  const [anchorEl, setAnchorEl] = useState(null)

  const handleSignOut = () => {
    setAnchorEl(null)
    signOut()
    navigate('/')
  }

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: 'linear-gradient(135deg, #E65100 0%, #BF360C 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <MenuBookIcon sx={{ mr: 1 }} />
        <Typography
          variant="h6"
          sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 600, flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          My Cookbook
        </Typography>

        {isSignedIn && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {!isMobile && (
              <>
                <Button
                  color="inherit"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/recipe/new')}
                  sx={{ opacity: location.pathname === '/recipe/new' ? 1 : 0.85 }}
                >
                  New Recipe
                </Button>
                <Button
                  color="inherit"
                  startIcon={<SendIcon />}
                  onClick={() => navigate('/send')}
                  sx={{ opacity: location.pathname === '/send' ? 1 : 0.85 }}
                >
                  Send
                </Button>
              </>
            )}
            <Tooltip title={user?.name || 'Account'}>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
                <Avatar
                  src={user?.picture}
                  alt={user?.name}
                  sx={{ width: 36, height: 36, border: '2px solid rgba(255,255,255,0.5)' }}
                >
                  {user?.name?.[0] || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem disabled sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="subtitle2" fontWeight={600}>{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </MenuItem>
          <Divider />
          {isMobile && [
            <MenuItem key="new" onClick={() => { setAnchorEl(null); navigate('/recipe/new') }}>
              <AddIcon sx={{ mr: 1, fontSize: 18 }} /> New Recipe
            </MenuItem>,
            <MenuItem key="send" onClick={() => { setAnchorEl(null); navigate('/send') }}>
              <SendIcon sx={{ mr: 1, fontSize: 18 }} /> Send Recipe
            </MenuItem>,
            <Divider key="div" />,
          ]}
          <MenuItem onClick={handleSignOut}>
            <LogoutIcon sx={{ mr: 1, fontSize: 18 }} /> Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  )
}
