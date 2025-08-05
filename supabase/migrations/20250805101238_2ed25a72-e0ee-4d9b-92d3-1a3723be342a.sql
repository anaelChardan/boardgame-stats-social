-- Update existing sessions to mark 'Nanou' as the session owner
-- This fixes the issue where all players show is_session_owner = false
UPDATE public.game_session_players 
SET is_session_owner = true 
WHERE player_name = 'Nanou';