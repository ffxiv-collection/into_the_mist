-- Change cost column from Integer to Numeric to support prices like 5.99
ALTER TABLE public.minion_sources 
ALTER COLUMN cost TYPE numeric(10, 2);
