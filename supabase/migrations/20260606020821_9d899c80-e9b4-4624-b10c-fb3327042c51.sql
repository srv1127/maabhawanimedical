
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.apply_stock_movement() SET search_path = public;
ALTER FUNCTION public.handle_sale_item() SET search_path = public;
ALTER FUNCTION public.next_invoice_no() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_invoice_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_no() TO authenticated;
