-- Link 'Aerith miniature' to 'Boutique' with a cost in 'Euro'

DO $$ 
DECLARE
    v_minion_id BIGINT;
    v_source_id BIGINT;
    v_currency_id BIGINT;
BEGIN
    -- 1. Find Minion ID (Aerith)
    SELECT id INTO v_minion_id FROM public.minions WHERE name ILIKE '%Aerith%' LIMIT 1;
    
    -- 2. Find Source ID (Boutique)
    SELECT id INTO v_source_id FROM public.sources WHERE name = 'Boutique' LIMIT 1;
    
    -- 3. Find Currency ID (Euro)
    SELECT id INTO v_currency_id FROM public.currencies WHERE name = 'Euro' LIMIT 1;

    -- Check if we found everything
    IF v_minion_id IS NULL THEN
        RAISE NOTICE 'Minion Aerith not found!';
        RETURN;
    END IF;

    IF v_source_id IS NULL THEN
        RAISE NOTICE 'Source Boutique not found!';
        RETURN;
    END IF;

    -- 4. Clean up existing links for Aerith to avoid duplicates during test
    DELETE FROM public.minion_sources WHERE minion_id = v_minion_id;

    -- 5. Insert the new link
    -- Details: "Station Mog"
    -- Cost: 5.35
    -- Currency: Euro
    INSERT INTO public.minion_sources (minion_id, source_id, details, cost, currency_id)
    VALUES (v_minion_id, v_source_id, 'Station Mog', 5.35, v_currency_id);

    RAISE NOTICE 'Inserted Aerith source data successfully: Minion ID %, Source %, Cost 5.35 Euro', v_minion_id, v_source_id;
    
END $$;
