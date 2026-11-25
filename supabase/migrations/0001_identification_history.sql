-- Create identification_history table
CREATE TABLE identification_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  filename TEXT,
  image_url TEXT,
  result JSONB NOT NULL
);

-- Enable RLS
ALTER TABLE identification_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own records
CREATE POLICY "Users can view own history"
  ON identification_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own records
CREATE POLICY "Users can insert own history"
  ON identification_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own records
CREATE POLICY "Users can delete own history"
  ON identification_history FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster user queries
CREATE INDEX idx_history_user_id ON identification_history(user_id);
CREATE INDEX idx_history_created_at ON identification_history(created_at DESC);
