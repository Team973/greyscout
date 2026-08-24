ALTER TABLE public."AutoPath" ADD COLUMN is_default boolean DEFAULT false NOT NULL;
CREATE UNIQUE INDEX "autopath_default_unique" ON public."AutoPath" USING btree (team_number, event) WHERE (is_default = true);
