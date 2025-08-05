-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create games table to cache BoardGameGeek data
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bgg_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  min_players INTEGER,
  max_players INTEGER,
  playing_time INTEGER,
  year_published INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game sessions table
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create game session players table
CREATE TABLE public.game_session_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  score INTEGER,
  position INTEGER,
  is_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create friends table for social connections
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Create likes table for social posts
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_id)
);

-- Create comments table for social posts
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for games (public read, authenticated insert)
CREATE POLICY "Games are viewable by everyone" 
ON public.games 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert games" 
ON public.games 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Create RLS policies for game sessions
CREATE POLICY "Users can view their own sessions and public sessions" 
ON public.game_sessions 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.friends 
    WHERE (user_id = auth.uid() AND friend_id = game_sessions.user_id AND status = 'accepted')
    OR (friend_id = auth.uid() AND user_id = game_sessions.user_id AND status = 'accepted')
  )
);

CREATE POLICY "Users can create their own sessions" 
ON public.game_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
ON public.game_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
ON public.game_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for game session players
CREATE POLICY "Session players are viewable with session access" 
ON public.game_session_players 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions 
    WHERE id = session_id AND (
      auth.uid() = user_id OR 
      EXISTS (
        SELECT 1 FROM public.friends 
        WHERE (user_id = auth.uid() AND friend_id = game_sessions.user_id AND status = 'accepted')
        OR (friend_id = auth.uid() AND user_id = game_sessions.user_id AND status = 'accepted')
      )
    )
  )
);

CREATE POLICY "Users can manage players in their own sessions" 
ON public.game_session_players 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions 
    WHERE id = session_id AND auth.uid() = user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.game_sessions 
    WHERE id = session_id AND auth.uid() = user_id
  )
);

-- Create RLS policies for friends
CREATE POLICY "Users can view their own friendships" 
ON public.friends 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests" 
ON public.friends 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they're part of" 
ON public.friends 
FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete friendships they're part of" 
ON public.friends 
FOR DELETE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Create RLS policies for likes
CREATE POLICY "Likes are viewable by session viewers" 
ON public.likes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions 
    WHERE id = session_id AND (
      auth.uid() = user_id OR 
      EXISTS (
        SELECT 1 FROM public.friends 
        WHERE (user_id = auth.uid() AND friend_id = game_sessions.user_id AND status = 'accepted')
        OR (friend_id = auth.uid() AND user_id = game_sessions.user_id AND status = 'accepted')
      )
    )
  )
);

CREATE POLICY "Users can manage their own likes" 
ON public.likes 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for comments
CREATE POLICY "Comments are viewable by session viewers" 
ON public.comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions 
    WHERE id = session_id AND (
      auth.uid() = user_id OR 
      EXISTS (
        SELECT 1 FROM public.friends 
        WHERE (user_id = auth.uid() AND friend_id = game_sessions.user_id AND status = 'accepted')
        OR (friend_id = auth.uid() AND user_id = game_sessions.user_id AND status = 'accepted')
      )
    )
  )
);

CREATE POLICY "Users can create comments on viewable sessions" 
ON public.comments 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.game_sessions 
    WHERE id = session_id AND (
      auth.uid() = user_id OR 
      EXISTS (
        SELECT 1 FROM public.friends 
        WHERE (user_id = auth.uid() AND friend_id = game_sessions.user_id AND status = 'accepted')
        OR (friend_id = auth.uid() AND user_id = game_sessions.user_id AND status = 'accepted')
      )
    )
  )
);

CREATE POLICY "Users can update their own comments" 
ON public.comments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.comments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_friends_updated_at
  BEFORE UPDATE ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_games_bgg_id ON public.games(bgg_id);
CREATE INDEX idx_game_sessions_user_id ON public.game_sessions(user_id);
CREATE INDEX idx_game_sessions_played_at ON public.game_sessions(played_at DESC);
CREATE INDEX idx_game_session_players_session_id ON public.game_session_players(session_id);
CREATE INDEX idx_game_session_players_user_id ON public.game_session_players(user_id);
CREATE INDEX idx_friends_user_id ON public.friends(user_id);
CREATE INDEX idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX idx_friends_status ON public.friends(status);
CREATE INDEX idx_likes_session_id ON public.likes(session_id);
CREATE INDEX idx_likes_user_id ON public.likes(user_id);
CREATE INDEX idx_comments_session_id ON public.comments(session_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);