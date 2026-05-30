import { MotorLibrary } from "@/components/build-workspace";

export default async function MotorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MotorLibrary detailId={id} />;
}
