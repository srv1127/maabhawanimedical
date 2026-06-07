
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.medicines SET stock_qty = stock_qty + NEW.change_qty WHERE id = NEW.medicine_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stock_movements (medicine_id, type, change_qty, reference_id, notes, created_by)
  VALUES (NEW.medicine_id, 'sale', -NEW.qty, NEW.sale_id, 'Sale', auth.uid());
  RETURN NEW;
END; $$;
