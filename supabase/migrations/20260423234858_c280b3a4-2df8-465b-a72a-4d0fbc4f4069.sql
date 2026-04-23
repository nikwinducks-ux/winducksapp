CREATE OR REPLACE FUNCTION public.hhmm_to_minutes(_t text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _clean text;
  _parts text[];
  _hour int;
  _minute int;
  _suffix text;
BEGIN
  IF _t IS NULL OR btrim(_t) = '' THEN
    RETURN NULL;
  END IF;

  _clean := upper(regexp_replace(btrim(_t), '\s+', ' ', 'g'));

  IF _clean ~ '^[0-2]?\d:[0-5]\d(:[0-5]\d)?( AM| PM)$' THEN
    _suffix := right(_clean, 2);
    _parts := regexp_split_to_array(split_part(_clean, ' ', 1), ':');
    _hour := _parts[1]::int;
    _minute := _parts[2]::int;

    IF _hour < 1 OR _hour > 12 THEN
      RETURN NULL;
    END IF;

    IF _suffix = 'AM' THEN
      IF _hour = 12 THEN _hour := 0; END IF;
    ELSE
      IF _hour <> 12 THEN _hour := _hour + 12; END IF;
    END IF;

    RETURN _hour * 60 + _minute;
  ELSIF _clean ~ '^[0-2]?\d:[0-5]\d(:[0-5]\d)?$' THEN
    _parts := regexp_split_to_array(_clean, ':');
    _hour := _parts[1]::int;
    _minute := _parts[2]::int;

    IF _hour > 23 THEN
      RETURN NULL;
    END IF;

    RETURN _hour * 60 + _minute;
  END IF;

  RETURN NULL;
END;
$$;