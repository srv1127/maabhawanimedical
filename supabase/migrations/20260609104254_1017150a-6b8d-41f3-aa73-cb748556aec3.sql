CREATE TABLE public.advisor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symptoms text NOT NULL,
  age_years integer,
  sex text,
  pregnant boolean DEFAULT false,
  allergies text,
  conditions text,
  assessment text,
  red_flags text[] DEFAULT '{}',
  advice text,
  inventory_size integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.advisor_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.advisor_sessions(id) ON DELETE CASCADE,
  medicine_id uuid,
  name text NOT NULL,
  stock_qty integer NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  reason text,
  dosage text,
  duration text,
  cautions text,
  confidence text,
  rank integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_sessions TO authenticated;
GRANT ALL ON public.advisor_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_suggestions TO authenticated;
GRANT ALL ON public.advisor_suggestions TO service_role;

ALTER TABLE public.advisor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage own sessions" ON public.advisor_sessions FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can view all sessions" ON public.advisor_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can manage suggestions for own sessions" ON public.advisor_suggestions FOR ALL TO authenticated USING (session_id IN (SELECT id FROM public.advisor_sessions WHERE created_by = auth.uid())) WITH CHECK (session_id IN (SELECT id FROM public.advisor_sessions WHERE created_by = auth.uid()));
CREATE POLICY "Admins can view all suggestions" ON public.advisor_suggestions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));