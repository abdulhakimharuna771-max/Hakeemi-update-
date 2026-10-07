-- =============================================================================
-- 0009 — Application ID alphabet excludes every look-alike character
--
-- The generator's alphabet previously omitted 0, 1, I and O but still contained
-- L, which is easily misread as 1. The alphabet now omits 1, I, L and O and
-- keeps exactly 32 symbols, so the `% 32` mapping over a random byte stays
-- uniform (256 % 32 = 0) and the runtime self-check still passes.
--
-- Only the constant and its comment change; the derivation, the collision retry
-- and the returned format (GKO-<year>-<6 characters>) are untouched.
-- =============================================================================

create or replace function public.generate_application_number()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  -- Exactly 32 characters, so `% 32` over a random byte is uniform.
  -- 1, I, L and O are absent: those are the characters people mis-transcribe
  -- when reading an application ID aloud or copying it from a printout. A zero
  -- is safe because no capital O is ever generated.
  --
  -- 9 digits (0, 2-9) + 23 letters (A-Z without I, L and O) = 32.
  c_alphabet constant text := '023456789ABCDEFGHJKMNPQRSTUVWXYZ';
  c_year     constant text := to_char(now(), 'YYYY');
  v_hex    text;
  v_code   text;
  v_attempt int := 0;
  i        int := 0;
begin
  -- Guard against a future edit silently breaking the uniform mapping.
  if length(c_alphabet) <> 32 or length(replace(c_alphabet, substr(c_alphabet, 1, 1), '')) <> 31 then
    raise exception 'application_number_alphabet_must_be_32_unique_characters';
  end if;

  loop
    v_attempt := v_attempt + 1;

    -- A UUIDv4 hex string: the first 12 hex characters are 6 fully random
    -- bytes (the fixed version/variant nibbles live further along).
    v_hex := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    v_code := '';
    for i in 0..5 loop
      -- 256 % 32 = 0, so the mapping is uniform (no modulo bias).
      v_code := v_code
        || substr(c_alphabet, (('x' || substr(v_hex, i * 2 + 1, 2))::bit(8)::int % 32) + 1, 1);
    end loop;

    if not exists (
      select 1 from public.applications
      where application_number = 'GKO-' || c_year || '-' || v_code
    ) then
      return 'GKO-' || c_year || '-' || v_code;
    end if;

    if v_attempt >= 12 then
      raise exception 'application_number_generation_failed' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;
