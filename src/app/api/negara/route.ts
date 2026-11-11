import { apiUser, handle } from "@/lib/api";
import { countries } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await apiUser();
  return countries();
});
