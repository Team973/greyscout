ALTER TABLE public."StrategyBoard" ADD COLUMN auto_selections jsonb DEFAULT '[]'::jsonb NOT NULL;
