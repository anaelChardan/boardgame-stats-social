-- Add a field to track if a player is the session owner (the user who logged the game)
ALTER TABLE public.game_session_players 
ADD COLUMN is_session_owner boolean DEFAULT false;