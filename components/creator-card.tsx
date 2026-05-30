import { Star, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";

export function CreatorCard({ name, rating }: { name: string; rating: number }) {
  return (
    <Card className="p-5">
      <UserRound className="h-7 w-7 text-orange-300" />
      <h2 className="mt-3 font-semibold">{name}</h2>
      <p className="mt-2 flex items-center gap-1 text-sm text-orange-50/65"><Star className="h-4 w-4 text-amber-200" />{rating} creator rating</p>
    </Card>
  );
}
