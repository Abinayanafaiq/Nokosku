import { ApiError, apiUser, handle } from "@/lib/api";
import { services } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await apiUser();
  const negara = Number(new URL(req.url).searchParams.get("negara"));
  if (!negara) throw new ApiError("Pilih negara dulu.");
  return services(negara);
});
